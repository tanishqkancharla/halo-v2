import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { outdent } from "outdent";

/** Keep the trailing newline so fixtures match real source files. */
export const src = outdent({ trimTrailingNewline: false });

export async function writePluginFiles(
  directory: string,
  files: Record<string, string>,
) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(directory, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
}

export async function writePlugins(
  workspaceRoot: string,
  plugins: Record<string, Record<string, string>>,
) {
  for (const [id, files] of Object.entries(plugins)) {
    await writePluginFiles(join(workspaceRoot, ".halo", "plugins", id), files);
  }
}
