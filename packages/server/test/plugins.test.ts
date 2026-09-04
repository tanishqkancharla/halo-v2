import { haloProtocolVersion } from "@get-halo/shared/contract";
import path from "node:path";
import outdent from "outdent";
import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

serverTest(
  "builds and invokes a plugin",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "notes" });
    await server.harness.files.write({
      path: path.join(plugin.directory, "server.ts"),
      content: outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          ping: pluginOs.handler(({ context }) => ({ pluginId: context.pluginId })),
        };
      `,
    });

    await expect(
      server.rpc.plugins.invoke({
        pluginId: plugin.id,
        path: ["ping"],
        input: undefined,
      }),
    ).rejects.toThrow("Plugin 'notes' is not mounted");

    expect(await server.rpc.plugins.build()).toEqual({
      built: ["notes"],
      errors: [],
    });
    expect(
      await server.rpc.plugins.invoke({
        pluginId: plugin.id,
        path: ["ping"],
        input: undefined,
      }),
    ).toEqual({ pluginId: "notes" });
  },
  15_000,
);

serverTest(
  "reloads a plugin after its server changes",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "notes" });
    await server.harness.files.write({
      path: path.join(plugin.directory, "server.ts"),
      content: outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          ping: pluginOs.handler(({ context }) => ({ pluginId: context.pluginId })),
        };
      `,
    });
    await server.rpc.plugins.build();

    await server.harness.files.write({
      path: path.join(plugin.directory, "server.ts"),
      content: outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          ping: pluginOs.handler(() => ({ reloaded: true })),
        };
      `,
    });
    await server.rpc.plugins.build();

    expect(
      await server.rpc.plugins.invoke({
        pluginId: plugin.id,
        path: ["ping"],
        input: undefined,
      }),
    ).toEqual({ reloaded: true });
  },
  15_000,
);

serverTest(
  "streams plugin results",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "counter" });
    await server.harness.files.write({
      path: path.join(plugin.directory, "server.ts"),
      content: outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          count: pluginOs.handler(() => (async function* () {
            yield 1;
            yield 2;
          })()),
        };
      `,
    });
    await server.rpc.plugins.build();

    const result = await server.rpc.plugins.invoke({
      pluginId: plugin.id,
      path: ["count"],
      input: undefined,
    });
    // SAFETY: the plugin above defines count as an async iterable of numbers.
    const count = result as AsyncIterable<number>;
    const values: number[] = [];
    for await (const value of count) values.push(value);

    expect(values).toEqual([1, 2]);
  },
  15_000,
);

serverTest(
  "rejects duplicate and reserved plugin IDs",
  async ({ server }) => {
    await server.rpc.plugins.create({ id: "notes" });

    await expect(server.rpc.plugins.create({ id: "notes" })).rejects.toThrow(
      "Plugin 'notes' already exists",
    );
    await expect(server.rpc.plugins.create({ id: "new" })).rejects.toThrow(
      "Plugin id 'new' is invalid: reserved",
    );
  },
  15_000,
);

serverTest("requires RPC credentials", async ({ server }) => {
  expect(await server.rpc.server.info()).toEqual({
    protocolVersion: haloProtocolVersion,
  });
  const client = server.harness.createClient(server.host, server.port);
  await expect(client.server.info()).rejects.toThrow();
});

serverTest(
  "typechecks a storage plugin",
  async ({ server }) => {
    await server.rpc.plugins.create({ id: "items", storage: true });

    expect(await server.rpc.plugins.types()).toEqual({
      written: ["items"],
      diagnostics: [],
    });
  },
  15_000,
);

serverTest(
  "enforces plugin tool grants for every invocation",
  async ({ server }) => {
    await server.rpc.workspace.writeFile({
      path: "message.txt",
      content: "hello",
    });
    const reader = await server.rpc.plugins.create({ id: "reader" });
    const packagePath = path.join(reader.directory, "package.json");
    const setCapabilities = async (capabilities: string[]) => {
      // SAFETY: plugins.create writes a package object with a Halo manifest.
      const packageJson = JSON.parse(
        (await server.harness.files.read(packagePath)).toString("utf8"),
      ) as { halo: { capabilities?: string[] } };
      packageJson.halo.capabilities = capabilities;
      await server.harness.files.write({
        path: packagePath,
        content: `${JSON.stringify(packageJson, undefined, 2)}\n`,
      });
    };
    await setCapabilities(["files.read"]);
    await server.harness.files.write({
      path: path.join(reader.directory, "server.ts"),
      content: outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          read: pluginOs.handler(({ context }) =>
            context.tools.files.read({ path: "message.txt" }),
          ),
        };
      `,
    });
    await server.rpc.plugins.types();
    await server.rpc.plugins.build();

    const listed = await server.rpc.plugins.list();
    expect(listed.plugins.map((plugin) => plugin.id)).toContain("reader");

    const invokeReader = () =>
      server.rpc.plugins.invoke({
        pluginId: reader.id,
        path: ["read"],
        input: undefined,
      });

    expect(await server.rpc.plugins.check({ pluginId: reader.id })).toEqual({
      requested: ["files.read"],
      existing: ["files.read"],
      granted: [],
      missing: [],
    });
    expect(await invokeReader()).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await server.rpc.plugins.grant({ pluginId: reader.id });
    expect(await invokeReader()).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });

    await setCapabilities([]);
    expect(await invokeReader()).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await setCapabilities(["files.read"]);
    expect(await invokeReader()).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await server.rpc.plugins.grant({ pluginId: reader.id });
    expect(await invokeReader()).toEqual({
      ok: true,
      data: { path: "message.txt", text: "hello" },
    });
  },
  30_000,
);
