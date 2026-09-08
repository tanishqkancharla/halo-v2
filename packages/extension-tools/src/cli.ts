#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { buildExtension } from "./build.js";
import { scaffoldExtension } from "./scaffold.js";

async function main() {
  if (process.argv[2] === "build") return buildExtension(process.cwd());
  if (process.argv[2] === "scaffold" && process.argv[3] !== undefined) {
    const directory = resolve(process.argv[3]);
    return scaffoldExtension({ directory, name: basename(directory) });
  }
  console.error(
    "Usage: halo-extension build | halo-extension scaffold <directory>",
  );
  process.exitCode = 1;
}
const result = await main();
if (result instanceof Error) {
  console.error(result);
  process.exitCode = 1;
} else if (result !== undefined) console.log(result);
