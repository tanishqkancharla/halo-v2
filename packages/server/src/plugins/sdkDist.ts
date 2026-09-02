import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export function pluginSdkDistDirectory() {
  return join(
    dirname(require.resolve("@get-halo/plugin-sdk/package.json")),
    "dist",
  );
}
