#!/usr/bin/env node

import { Cli, z } from "incur";
import { callPluginProcedure, type PluginRouter } from "./callPlugin.js";
import { cliVersion, connectHalo } from "./connectHalo.js";
import { HaloRpcFileError } from "./rpcFile.js";
import { parsePluginArgv } from "./parsePluginArgv.js";

type WorkspaceInfo = {
  name: string;
  workspaceRoot: string;
};

type HaloHost = {
  getAppInfo: () => Promise<{ version: string }>;
  workspace: {
    get: () => Promise<WorkspaceInfo | undefined>;
  };
  plugins: {
    create: (input: { id: string }) => Promise<{
      id: string;
      directory: string;
    }>;
    build: () => Promise<{
      built: string[];
      errors: Array<{ id: string; message: string }>;
    }>;
    types: () => Promise<{
      written: string[];
      diagnostics: Array<{
        id: string;
        file: string;
        line: number;
        message: string;
      }>;
    }>;
    servers: PluginRouter;
  };
};

const haloRpcEnv = z.object({
  HALO_RPC_FILE: z.string().optional().describe("Path to Halo rpc.json"),
  HALO_USER_DATA: z
    .string()
    .optional()
    .describe("Halo userData directory that contains rpc.json"),
});

const workspaceInfo = z.object({
  name: z.string(),
  workspaceRoot: z.string(),
});

const pluginLoadError = z.object({
  id: z.string(),
  message: z.string(),
});

rewritePluginInvokeArgv();

const plugin = Cli.create("plugin", {
  description: "Create, build, typecheck, or call a workspace plugin",
})
  .command("new", {
    description: "Scaffold a plugin in the open workspace",
    args: z.object({
      id: z.string().describe("Plugin id: [a-z][a-z0-9-]*"),
    }),
    env: haloRpcEnv,
    output: z.object({
      id: z.string(),
      directory: z.string(),
    }),
    async run(c) {
      const connected = await connectHost(c.env);
      if (connected instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: connected.message,
        });
      }
      const created = await connected.client.plugins
        .create({ id: c.args.id })
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (created instanceof Error) {
        return c.error({ code: "PLUGIN", message: created.message });
      }
      return c.ok(created);
    },
  })
  .command("build", {
    description: "Compile each plugin view to dist/view.js",
    env: haloRpcEnv,
    output: z.object({
      built: z.array(z.string()),
      errors: z.array(pluginLoadError),
    }),
    async run(c) {
      const connected = await connectHost(c.env);
      if (connected instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: connected.message,
        });
      }
      const built = await connected.client.plugins
        .build()
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (built instanceof Error) {
        return c.error({ code: "PLUGIN", message: built.message });
      }
      if (built.errors.length > 0) {
        return c.error({
          code: "PLUGIN",
          message: built.errors
            .map((error) => `${error.id}: ${error.message}`)
            .join("\n"),
        });
      }
      return c.ok(built);
    },
  })
  .command("types", {
    description: "Write plugin type declarations and typecheck",
    env: haloRpcEnv,
    output: z.object({
      written: z.array(z.string()),
      diagnostics: z.array(
        z.object({
          id: z.string(),
          file: z.string(),
          line: z.number(),
          message: z.string(),
        }),
      ),
    }),
    async run(c) {
      const connected = await connectHost(c.env);
      if (connected instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: connected.message,
        });
      }
      const checked = await connected.client.plugins
        .types()
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (checked instanceof Error) {
        return c.error({ code: "PLUGIN", message: checked.message });
      }
      if (checked.diagnostics.length > 0) {
        return c.error({
          code: "TYPECHECK",
          message: checked.diagnostics
            .map(
              (diagnostic) =>
                `${diagnostic.id} ${diagnostic.file}:${diagnostic.line}: ${diagnostic.message}`,
            )
            .join("\n"),
        });
      }
      return c.ok(checked);
    },
  })
  .command("call", {
    description: "Call a plugin procedure (also: halo plugin <id> <endpoint>)",
    args: z.object({
      id: z.string().describe("Plugin id"),
      endpoint: z
        .string()
        .describe("Procedure path, such as ping or todos.list"),
    }),
    options: z.object({
      input: z.string().optional().describe("JSON payload for the procedure"),
    }),
    env: haloRpcEnv,
    output: z.object({ result: z.unknown() }),
    async run(c) {
      const parsed = parsePluginArgv(
        [c.args.id, c.args.endpoint],
        c.options.input,
      );
      if (parsed instanceof Error) {
        return c.error({ code: "USAGE", message: parsed.message });
      }
      if (parsed.kind !== "call") {
        return c.error({
          code: "USAGE",
          message: "expected a plugin id and procedure path",
        });
      }

      if (c.args.endpoint.length === 0) {
        return c.error({
          code: "USAGE",
          message: "missing procedure path",
        });
      }

      const connected = await connectHost(c.env);
      if (connected instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: connected.message,
        });
      }

      const result = await callPluginProcedure({
        client: { plugins: connected.client.plugins.servers },
        id: parsed.id,
        path: parsed.path,
        input: parsed.input,
      });
      if (result instanceof Error) {
        return c.error({ code: "PLUGIN", message: result.message });
      }
      return c.ok({ result });
    },
  });

const haloVersion = cliVersion();

Cli.create("halo", {
  description: "Talk to a running Halo app",
  version: haloVersion === undefined ? "dev" : haloVersion,
})
  .command("status", {
    description: "Check whether Halo is running and report its workspace",
    env: haloRpcEnv,
    output: z.object({
      version: z.string(),
      host: z.literal("127.0.0.1"),
      port: z.number(),
      workspace: workspaceInfo.optional(),
    }),
    async run(c) {
      const connected = await connectHost(c.env);
      if (connected instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: connected.message,
        });
      }
      const info = await connected.client
        .getAppInfo()
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (info instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: info.message,
        });
      }
      const workspace = await connected.client.workspace
        .get()
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (workspace instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: workspace.message,
        });
      }
      return c.ok({
        version: info.version,
        host: connected.file.host,
        port: connected.file.port,
        workspace,
      });
    },
  })
  .command(plugin)
  .serve();

function connectHost(env: { HALO_RPC_FILE?: string; HALO_USER_DATA?: string }) {
  return connectHalo<HaloHost>(env);
}

function wrapRpc(error: { message: string }) {
  return new HaloRpcFileError({
    detail: error.message,
    cause: error,
  });
}

function rewritePluginInvokeArgv() {
  const reserved = new Set(["new", "build", "types", "call"]);
  const argv = process.argv;
  const pluginAt = argv.indexOf("plugin");
  if (pluginAt === -1) return;
  const next = argv[pluginAt + 1];
  if (next === undefined || next.startsWith("-") || reserved.has(next)) {
    return;
  }

  const rest = argv.slice(pluginAt + 1);
  const tokens: string[] = [];
  const flags: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === undefined) continue;
    if (arg.startsWith("-")) {
      flags.push(arg);
      const value = rest[i + 1];
      if (
        value !== undefined &&
        !value.startsWith("-") &&
        arg !== "--help" &&
        arg !== "--json" &&
        arg !== "--verbose" &&
        arg !== "--llms" &&
        arg !== "--mcp"
      ) {
        flags.push(value);
        i += 1;
      }
      continue;
    }
    tokens.push(arg);
  }

  const id = tokens[0];
  if (id === undefined) return;
  const endpoint = tokens.slice(1).join(".");
  process.argv = [
    ...argv.slice(0, pluginAt + 1),
    "call",
    id,
    endpoint,
    ...flags,
  ];
}
