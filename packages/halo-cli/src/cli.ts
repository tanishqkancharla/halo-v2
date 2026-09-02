#!/usr/bin/env node

import { Cli, z } from "incur";
import * as errore from "errore";
import { cliVersion, connectHalo } from "./connectHalo.js";
import { HaloRpcFileError } from "./rpcFile.js";
import { parsePluginArgv, type PluginJson } from "./parsePluginArgv.js";

type WorkspaceInfo = {
  name: string;
  workspaceRoot: string;
};

type PluginProcedureOutput = PluginJson | undefined | AsyncIterable<PluginJson>;

class PluginCallError extends errore.createTaggedError({
  name: "PluginCallError",
  message: "Plugin call failed: $detail",
}) {}

type HaloHost = {
  getServerInfo: () => Promise<{ version: string }>;
  workspace: {
    get: () => Promise<WorkspaceInfo | undefined>;
  };
  plugins: {
    list: () => Promise<{
      plugins: Array<{
        id: string;
        directory: string;
        halo: { name: string };
      }>;
      errors: Array<{ id: string; message: string }>;
    }>;
    create: (input: { id: string; storage?: boolean }) => Promise<{
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
    invoke: (input: {
      pluginId: string;
      path: string[];
      input: unknown;
    }) => Promise<PluginProcedureOutput>;
    check: (input: { pluginId: string }) => Promise<{
      requested: string[];
      existing: string[];
      granted: string[];
      missing: string[];
    }>;
    grant: (input: { pluginId: string }) => Promise<{
      requested: string[];
      existing: string[];
      granted: string[];
      newlyGranted: string[];
      missing: string[];
    }>;
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
  description:
    "List, create, build, typecheck, grant, or call a workspace plugin",
})
  .command("list", {
    description: "List workspace plugins",
    env: haloRpcEnv,
    output: z.object({
      plugins: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          directory: z.string(),
        }),
      ),
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
      const listed = await connected.client.plugins
        .list()
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (listed instanceof Error) {
        return c.error({ code: "PLUGIN", message: listed.message });
      }
      return c.ok({
        plugins: listed.plugins.map((entry) => ({
          id: entry.id,
          name: entry.halo.name,
          directory: entry.directory,
        })),
        errors: listed.errors,
      });
    },
  })
  .command("new", {
    description: "Scaffold a plugin in the open workspace",
    args: z.object({
      id: z.string().describe("Plugin id: [a-z][a-z0-9-]*"),
    }),
    options: z.object({
      storage: z
        .boolean()
        .optional()
        .describe("Include persistent storage and a working stored-list view"),
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
        .create({ id: c.args.id, storage: c.options.storage })
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
  .command("check", {
    description:
      "Compare a plugin's requested tools with its grants and the live catalog",
    args: z.object({
      id: z.string().describe("Plugin id"),
    }),
    env: haloRpcEnv,
    output: z.object({
      requested: z.array(z.string()),
      existing: z.array(z.string()),
      granted: z.array(z.string()),
      missing: z.array(z.string()),
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
        .check({ pluginId: c.args.id })
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (checked instanceof Error) {
        return c.error({ code: "PLUGIN", message: checked.message });
      }
      return c.ok(checked);
    },
  })
  .command("grant", {
    description:
      "Grant a plugin's declared tools that exist in the live catalog",
    args: z.object({
      id: z.string().describe("Plugin id"),
    }),
    env: haloRpcEnv,
    output: z.object({
      requested: z.array(z.string()),
      existing: z.array(z.string()),
      granted: z.array(z.string()),
      newlyGranted: z.array(z.string()),
      missing: z.array(z.string()),
    }),
    async run(c) {
      const connected = await connectHost(c.env);
      if (connected instanceof Error) {
        return c.error({
          code: "NOT_RUNNING",
          message: connected.message,
        });
      }
      const granted = await connected.client.plugins
        .grant({ pluginId: c.args.id })
        .catch((e) => wrapRpc(e instanceof Error ? e : new Error(String(e))));
      if (granted instanceof Error) {
        return c.error({ code: "PLUGIN", message: granted.message });
      }
      return c.ok(granted);
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

      const result = await connected.client.plugins
        .invoke({
          pluginId: parsed.id,
          path: parsed.path,
          input: parsed.input,
        })
        .catch(
          (e) =>
            new PluginCallError({
              detail: e instanceof Error ? e.message : String(e),
              cause: e,
            }),
        );
      if (result instanceof Error) {
        return c.error({ code: "PLUGIN", message: result.message });
      }
      if (isAsyncIterable(result)) {
        const closed = await result[Symbol.asyncIterator]()
          .return?.()
          .catch(
            (e) => new PluginCallError({ detail: "close stream", cause: e }),
          );
        if (closed instanceof Error) {
          return c.error({ code: "PLUGIN", message: closed.message });
        }
        return c.error({
          code: "PLUGIN",
          message: "streaming plugin procedures are not supported by the CLI",
        });
      }
      return c.ok({ result });
    },
  });

const haloVersion = cliVersion();

async function main() {
  await Cli.create("halo", {
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
          .getServerInfo()
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
}

main().catch((cause: unknown) => {
  console.error(cause);
  process.exitCode = 1;
});

function connectHost(env: { HALO_RPC_FILE?: string; HALO_USER_DATA?: string }) {
  return connectHalo<HaloHost>(env);
}

function isAsyncIterable(
  value: PluginProcedureOutput,
): value is AsyncIterable<PluginJson> {
  if (value === undefined || value === null) return false;
  if (!(value instanceof Object)) return false;
  return Symbol.asyncIterator in value;
}

function wrapRpc(error: { message: string }) {
  return new HaloRpcFileError({
    detail: error.message,
    cause: error,
  });
}

function rewritePluginInvokeArgv() {
  const reserved = new Set([
    "new",
    "build",
    "types",
    "call",
    "list",
    "check",
    "grant",
  ]);
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
