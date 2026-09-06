import { haloProtocolVersion } from "@get-halo/shared/contract";
import type { PluginContributions } from "@halo/plugin-sdk/schema";
import { symlink } from "node:fs/promises";
import path from "node:path";
import outdent from "outdent";
import { describe, expect } from "vitest";
import { serverTest } from "./serverTest.js";
import type { PluginFiles } from "./PluginFiles.js";

describe("plugin contributions", { timeout: 15_000 }, () => {
  const contributionTest = serverTest.extend<{
    plugin: {
      id: string;
      directory: string;
      files: PluginFiles;
      contributes: PluginContributions;
    };
  }>({
    plugin: async ({ server }, use) => {
      const plugin = await server.rpc.plugins.create({ id: "sessions" });
      const files = server.harness.pluginFiles(plugin);
      const contributes: PluginContributions = {
        sidebar: ["first", "second"].map((id) => ({
          id,
          title: id,
          target: { paneId: "session", params: { sessionId: id } },
        })),
        panes: [
          {
            id: "session",
            title: "Session",
            content: { kind: "webview", entry: "./Session.tsx" },
          },
        ],
      };
      await files.updateManifest({ contributes });
      await files.write({
        "Session.tsx": "export default function Session() { return null; }",
      });
      await use({ ...plugin, files, contributes });
    },
  });

  contributionTest(
    "discovers two targets of the same pane",
    async ({ server, plugin }) => {
      await server.rpc.plugins.build();

      const listed = await server.rpc.plugins.list();
      expect(
        listed.contributions.flatMap(({ contributes }) =>
          contributes.sidebar.map(({ target }) => target),
        ),
      ).toEqual(plugin.contributes.sidebar.map(({ target }) => target));
    },
  );

  contributionTest(
    "publishes edited sidebar targets after rebuilding the plugin",
    async ({ server, plugin }) => {
      await server.rpc.plugins.build();

      const contributes: PluginContributions = {
        ...plugin.contributes,
        sidebar: [
          {
            id: "first",
            title: "Renamed session",
            target: { paneId: "session", params: { sessionId: "first" } },
          },
          {
            id: "third",
            title: "New session",
            target: { paneId: "session", params: { sessionId: "third" } },
          },
        ],
      };
      await plugin.files.updateManifest({ contributes });
      await server.rpc.plugins.build();

      const listed = await server.rpc.plugins.list();
      expect(
        listed.contributions.flatMap((entry) => entry.contributes.sidebar),
      ).toEqual(contributes.sidebar);
    },
  );

  contributionTest(
    "discovers separate session and settings panes in one plugin",
    async ({ server, plugin }) => {
      await plugin.files.write({
        "Settings.tsx":
          "export default function Settings() { return 'Settings'; }",
      });
      const contributes: PluginContributions = {
        sidebar: [
          ...plugin.contributes.sidebar,
          {
            id: "settings",
            title: "Settings",
            target: { paneId: "settings", params: {} },
          },
        ],
        panes: [
          ...plugin.contributes.panes,
          {
            id: "settings",
            title: "Settings",
            content: { kind: "webview", entry: "./Settings.tsx" },
          },
        ],
      };
      await plugin.files.updateManifest({ contributes });
      await server.rpc.plugins.build();

      const listed = await server.rpc.plugins.list();
      expect(
        listed.contributions.flatMap((entry) => entry.contributes.panes),
      ).toEqual(contributes.panes);
    },
  );

  contributionTest(
    "discovers two plugins that use the same local pane and sidebar IDs",
    async ({ server, plugin }) => {
      const archive = await server.rpc.plugins.create({ id: "archive" });
      const files = server.harness.pluginFiles(archive);
      await files.updateManifest({ contributes: plugin.contributes });
      await files.write({
        "Session.tsx":
          "export default function Session() { return 'Archived session'; }",
      });
      await server.rpc.plugins.build();

      const listed = await server.rpc.plugins.list();
      expect(listed.contributions).toMatchObject(
        [archive.id, plugin.id].map((pluginId) => ({
          pluginId,
          contributes: {
            sidebar: [{ id: "first" }, { id: "second" }],
            panes: [{ id: "session" }],
          },
        })),
      );
    },
  );

  describe("manifest validation", () => {
    contributionTest.for(["sidebar", "panes"] as const)(
      "rejects duplicate %s IDs",
      async (kind, { server, plugin }) => {
        await plugin.files.updateManifest({
          contributes: {
            ...plugin.contributes,
            [kind]: [...plugin.contributes[kind], ...plugin.contributes[kind]],
          },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          {
            id: plugin.id,
            message: expect.stringContaining(`duplicate ${kind} id`),
          },
        ]);
      },
    );

    contributionTest(
      "rejects a sidebar target without a declared pane",
      async ({ server, plugin }) => {
        await plugin.files.updateManifest({
          contributes: { ...plugin.contributes, panes: [] },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          {
            id: plugin.id,
            message: expect.stringContaining("targets unknown pane"),
          },
        ]);
      },
    );

    contributionTest(
      "rejects non-string pane parameters",
      async ({ server, plugin }) => {
        await plugin.files.updateManifest({
          contributes: {
            ...plugin.contributes,
            sidebar: [
              {
                id: "bad",
                title: "Bad",
                target: { paneId: "session", params: { sessionId: 42 } },
              },
            ],
          },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          {
            id: plugin.id,
            message: expect.stringContaining("/params/sessionId"),
          },
        ]);
      },
    );

    contributionTest.for([
      {
        name: "missing files",
        entry: "./missing.tsx",
        error: "cannot resolve pane",
      },
      { name: "directories", entry: ".", error: "entry must be a file" },
    ])(
      "rejects $name as pane entries",
      async ({ entry, error }, { server, plugin }) => {
        await plugin.files.updateManifest({
          contributes: {
            ...plugin.contributes,
            panes: [
              {
                id: "session",
                title: "Session",
                content: { kind: "webview", entry },
              },
            ],
          },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          { id: plugin.id, message: expect.stringContaining(error) },
        ]);
      },
    );

    contributionTest(
      "rejects absolute pane entry paths",
      async ({ server, plugin }) => {
        await plugin.files.updateManifest({
          contributes: {
            ...plugin.contributes,
            panes: [
              {
                id: "session",
                title: "Session",
                content: {
                  kind: "webview",
                  entry: path.join(plugin.directory, "Session.tsx"),
                },
              },
            ],
          },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          {
            id: plugin.id,
            message: expect.stringContaining("entry must be relative"),
          },
        ]);
      },
    );

    contributionTest(
      "rejects pane entries outside the plugin directory",
      async ({ server, plugin }) => {
        await plugin.files.write({
          "../outside.tsx": "export default function Outside() {}",
        });
        await plugin.files.updateManifest({
          contributes: {
            ...plugin.contributes,
            panes: [
              {
                id: "session",
                title: "Session",
                content: { kind: "webview", entry: "../outside.tsx" },
              },
            ],
          },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          {
            id: plugin.id,
            message: expect.stringContaining("entry must stay inside"),
          },
        ]);
      },
    );

    contributionTest(
      "rejects pane symlinks outside the plugin directory",
      async ({ server, plugin }) => {
        await plugin.files.write({
          "../outside.tsx": "export default function Outside() {}",
        });
        await symlink(
          path.join(plugin.directory, "../outside.tsx"),
          path.join(plugin.directory, "escape.tsx"),
        );
        await plugin.files.updateManifest({
          contributes: {
            ...plugin.contributes,
            panes: [
              {
                id: "session",
                title: "Session",
                content: { kind: "webview", entry: "./escape.tsx" },
              },
            ],
          },
        });
        await server.rpc.plugins.build();

        expect((await server.rpc.plugins.list()).errors).toEqual([
          {
            id: plugin.id,
            message: expect.stringContaining("entry must stay inside"),
          },
        ]);
      },
    );

    contributionTest(
      "keeps valid contributions discoverable beside an invalid plugin",
      async ({ server, plugin }) => {
        const healthy = await server.rpc.plugins.create({ id: "healthy" });
        const files = server.harness.pluginFiles(healthy);
        await files.updateManifest({ contributes: plugin.contributes });
        await files.write({
          "Session.tsx": "export default function Session() { return null; }",
        });
        await plugin.files.updateManifest({
          contributes: { ...plugin.contributes, panes: [] },
        });
        await server.rpc.plugins.build();

        const listed = await server.rpc.plugins.list();
        expect(listed.contributions.map(({ pluginId }) => pluginId)).toEqual([
          healthy.id,
        ]);
      },
    );
  });
});

serverTest(
  "builds and invokes a plugin",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "notes" });
    await server.harness.pluginFiles(plugin).write({
      "server.ts": outdent`
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
  "reloads plugin code on build, not when a client lists plugins",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "notes" });
    await server.harness.pluginFiles(plugin).write({
      "server.ts": outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          ping: pluginOs.handler(({ context }) => ({ pluginId: context.pluginId })),
        };
      `,
    });
    await server.rpc.plugins.build();

    await server.harness.pluginFiles(plugin).write({
      "server.ts": outdent`
        import { pluginOs } from "@get-halo/plugin-sdk/server";

        export default {
          ping: pluginOs.handler(() => ({ reloaded: true })),
        };
      `,
    });
    await server.rpc.plugins.list();
    expect(
      await server.rpc.plugins.invoke({
        pluginId: plugin.id,
        path: ["ping"],
        input: undefined,
      }),
    ).toEqual({ pluginId: "notes" });

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
    await server.harness.pluginFiles(plugin).write({
      "server.ts": outdent`
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
    const files = server.harness.pluginFiles(reader);
    await files.updateManifest({ capabilities: ["files.read"] });
    await files.write({
      "server.ts": outdent`
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

    await files.updateManifest({ capabilities: [] });
    expect(await invokeReader()).toMatchObject({
      ok: false,
      error: { code: "tool_not_granted" },
    });

    await files.updateManifest({ capabilities: ["files.read"] });
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
