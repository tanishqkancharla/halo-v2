import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { haloCliResourceName } from "../src/main/workspace/installHaloCli.js";

const electronDir = join(dirname(fileURLToPath(import.meta.url)), "..");

export function haloCliBundlePath() {
  return join(electronDir, "../../packages/halo-cli/dist", haloCliResourceName);
}

export async function bundleHaloCli() {
  const outfile = haloCliBundlePath();
  await mkdir(dirname(outfile), { recursive: true });
  await esbuild.build({
    entryPoints: [join(electronDir, "../../packages/halo-cli/src/cli.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    logLevel: "silent",
  });
  return outfile;
}
