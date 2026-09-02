import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FilesystemService } from "../filesystem/FilesystemService.js";
import { copyPluginWorkspacePackages } from "./copyPluginWorkspacePackages.js";
import { typecheckPlugin, writePluginTsconfig } from "./typecheckPlugin.js";

const typecheckTest = test.extend<{ pluginDir: string }>({
  pluginDir: async ({ task }, use) => {
    const directory = await mkdtemp(
      join(tmpdir(), `halo-plugin-types-${task.id}-`),
    );
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
});

describe("typecheckPlugin", () => {
  typecheckTest(
    "typechecks a view using the plugin's own node_modules",
    async ({ pluginDir }) => {
      await writeFile(
        join(pluginDir, "view.tsx"),
        `import { H1 } from "maui";
import { Route, Switch } from "wouter";

export function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
    </Switch>
  );
}

function Home() {
  return <H1>Home</H1>;
}
`,
      );
      await mkdir(join(pluginDir, "node_modules"), { recursive: true });
      await copyPluginWorkspacePackages(pluginDir);
      const filesystem = new FilesystemService();
      const written = await writePluginTsconfig({
        filesystem,
        directory: pluginDir,
      });
      expect(written).toBeUndefined();
      expect(
        await typecheckPlugin({ filesystem, directory: pluginDir }),
      ).toEqual([]);
    },
  );
});
