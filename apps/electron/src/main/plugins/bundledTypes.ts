import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export function bundledTypesDirectory() {
  return join(
    dirname(require.resolve("@halo/plugin-sdk/package.json")),
    "bundled-types",
  );
}
