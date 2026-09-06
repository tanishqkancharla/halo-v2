import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import * as errore from "errore";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

class PluginSdkBuildError extends errore.createTaggedError({
  name: "PluginSdkBuildError",
  message: "Failed to build plugin SDK artifacts",
}) {}

export async function buildPluginSdk() {
  const root = dirname(require.resolve("@halo/plugin-sdk/package.json"));
  const built = await execFileAsync(process.execPath, [
    join(dirname(require.resolve("typescript/package.json")), "bin", "tsc"),
    "-p",
    join(root, "tsconfig.build.json"),
  ]).catch((cause) => new PluginSdkBuildError({ cause }));
  if (built instanceof Error) return built;
}
