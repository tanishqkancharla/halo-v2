import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as errore from "errore";

export class ContractPackageError extends errore.createTaggedError({
  name: "ContractPackageError",
  message: "Failed to write plugin SDK contract: $detail",
}) {}

export const contractPackageName = "@get-halo/plugin-sdk";

export const contractTypeFiles = [
  "sdk/view.d.ts",
  "server.d.ts",
  "schema.d.ts",
  "storage.d.ts",
  "global.d.ts",
  "index.d.ts",
  "csstype.d.ts",
  "jsx-runtime.d.ts",
] as const;

export function contractPackageJson(version: string) {
  return {
    name: contractPackageName,
    version,
    type: "module",
    repository: {
      type: "git",
      url: "https://github.com/tanishqkancharla/halo-v2.git",
    },
    publishConfig: {
      access: "public",
    },
    exports: {
      "./view": { types: "./bundled-types/sdk/view.d.ts" },
      "./server": { types: "./bundled-types/server.d.ts" },
      "./schema": { types: "./bundled-types/schema.d.ts" },
      "./storage": { types: "./bundled-types/storage.d.ts" },
      "./package.json": "./package.json",
    },
  };
}

export async function writeContractPackage(args: {
  directory: string;
  version: string;
  bundledTypesDir: string;
}) {
  const created = await mkdir(args.directory, { recursive: true }).catch(
    (e) => new ContractPackageError({ detail: "create directory", cause: e }),
  );
  if (created instanceof Error) return created;

  const copied = await cp(
    args.bundledTypesDir,
    join(args.directory, "bundled-types"),
    { recursive: true },
  ).catch(
    (e) => new ContractPackageError({ detail: "copy bundled-types", cause: e }),
  );
  if (copied instanceof Error) return copied;

  return writeFile(
    join(args.directory, "package.json"),
    `${JSON.stringify(contractPackageJson(args.version), undefined, 2)}\n`,
  ).catch(
    (e) => new ContractPackageError({ detail: "write package.json", cause: e }),
  );
}
