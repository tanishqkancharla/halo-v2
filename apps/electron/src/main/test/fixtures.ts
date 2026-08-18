import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { outdent } from "outdent";
import { test } from "vitest";
import { WorkspaceService } from "../workspace-service.js";

/** Keep the trailing newline so fixtures match real source files. */
export const src = outdent({ trimTrailingNewline: false });

type PluginFiles = Record<string, string>;
type PluginTree = Record<string, PluginFiles>;

export const pluginTest = test.extend<{
  appDataDir: string;
  workspaceRoot: string;
  workspace: WorkspaceService;
  writePlugin: (plugins: PluginTree) => Promise<void>;
}>({
  appDataDir: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-app-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspaceRoot: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-ws-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  workspace: async ({ appDataDir }, use) => {
    await use(new WorkspaceService(appDataDir));
  },
  writePlugin: async ({ workspace, workspaceRoot }, use) => {
    const selected = await workspace.select(workspaceRoot);
    if (selected instanceof Error) throw selected;
    const layout = workspace.getLayout();
    if (layout instanceof Error) throw layout;
    await use(async (plugins) => {
      await writePluginFiles(layout.root, plugins);
    });
  },
});

async function writePluginFiles(workspaceRoot: string, plugins: PluginTree) {
  for (const [id, files] of Object.entries(plugins)) {
    for (const [relativePath, contents] of Object.entries(files)) {
      const path = join(workspaceRoot, ".halo", "plugins", id, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents);
    }
  }
}
