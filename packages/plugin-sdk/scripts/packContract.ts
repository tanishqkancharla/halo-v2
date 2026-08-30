import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeContractPackage } from "../src/contractPackage.ts";

const version = process.argv[2];
if (version === undefined) {
  console.error("usage: pack:contract <version>");
  process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const written = await writeContractPackage({
  directory: join(root, "contract"),
  version,
  distDir: join(root, "dist"),
});
if (written instanceof Error) {
  console.error(written.message);
  process.exit(1);
}
