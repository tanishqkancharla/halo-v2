import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [
  "view.d.ts",
  "server.d.ts",
  "schema.d.ts",
  "storage.d.ts",
  "react.d.ts",
  "jsx-runtime.d.ts",
];
for (const file of files) {
  const path = join(root, "bundled-types", file);
  if (!existsSync(path)) {
    throw new Error(`missing ${path}`);
  }
}
