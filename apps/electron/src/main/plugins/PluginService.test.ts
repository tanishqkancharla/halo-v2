import { describe, expect } from "vitest";
import { pluginTest, src } from "../test/fixtures.js";
import { WorkspaceNotReadyError } from "../workspace-service.js";
import { PluginService } from "./PluginService.js";

describe("PluginService", () => {
  pluginTest(
    "returns WorkspaceNotReadyError before a workspace is chosen",
    async ({ workspace }) => {
      const listed = await new PluginService(workspace).list();
      expect(listed).toBeInstanceOf(WorkspaceNotReadyError);
    },
  );

  pluginTest(
    "lists a valid plugin folder",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
          "view.tsx": src`
            export const Sidebar = () => null
          `,
        },
      });

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.plugins[0]?.halo.name).toBe("Calendar");
      expect(listed.errors).toEqual([]);
    },
  );

  pluginTest(
    "keeps a valid plugin when another package.json is broken",
    async ({ workspace, writePlugin }) => {
      await writePlugin({
        calendar: {
          "package.json": src`
            {
              "name": "halo-plugin-calendar",
              "halo": { "version": 1, "name": "Calendar" }
            }
          `,
        },
        broken: {
          "package.json": src`
            { not json
          `,
        },
        ".hidden": {
          "package.json": src`
            {
              "name": "halo-plugin-hidden",
              "halo": { "version": 1, "name": "Hidden" }
            }
          `,
        },
      });

      const listed = await new PluginService(workspace).list();
      if (listed instanceof Error) throw listed;

      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["calendar"]);
      expect(listed.errors.map((error) => error.id)).toEqual(["broken"]);
    },
  );
});
