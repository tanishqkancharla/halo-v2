import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as errore from "errore";

export class ContractPackageError extends errore.createTaggedError({
  name: "ContractPackageError",
  message: "Failed to write plugin SDK contract: $detail",
}) {}

export const contractPackageName = "@get-halo/plugin-sdk";

export const contractTypeFiles = [
  "view.d.ts",
  "server.d.ts",
  "schema.d.ts",
  "storage.d.ts",
] as const;

export const contractPeerDependencies = {
  maui: "0.0.11",
  "purse-styles": "^0.2.1",
  react: "^19.2.8",
  wouter: "^3.10.0",
} as const;

export const contractDependencies = {
  "@orpc/server": "2.0.0-beta.29",
  "@sinclair/typebox": "^0.34.52",
  "@tanishqkancharla/tandem-core": "0.2.0",
  "@tanishqkancharla/tandem-server": "0.2.0",
  errore: "^0.14.1",
} as const;

export const mauiPackage = "npm:@tanishqkancharla/maui@0.0.11";

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
    dependencies: contractDependencies,
    peerDependencies: contractPeerDependencies,
    exports: {
      "./view": { types: "./dist/view.d.ts" },
      "./server": { types: "./dist/server.d.ts" },
      "./schema": { types: "./dist/schema.d.ts" },
      "./storage": { types: "./dist/storage.d.ts" },
      "./package.json": "./package.json",
    },
  };
}

export async function writeContractPackage(args: {
  directory: string;
  version: string;
  distDir: string;
}) {
  const created = await mkdir(args.directory, { recursive: true }).catch(
    (e) => new ContractPackageError({ detail: "create directory", cause: e }),
  );
  if (created instanceof Error) return created;

  const distDirectory = join(args.directory, "dist");
  const removed = await rm(distDirectory, {
    recursive: true,
    force: true,
  }).catch(
    (e) => new ContractPackageError({ detail: "remove dist", cause: e }),
  );
  if (removed instanceof Error) return removed;

  const copied = await cp(args.distDir, distDirectory, {
    recursive: true,
  }).catch((e) => new ContractPackageError({ detail: "copy dist", cause: e }));
  if (copied instanceof Error) return copied;

  return writeFile(
    join(args.directory, "package.json"),
    `${JSON.stringify(contractPackageJson(args.version), undefined, 2)}\n`,
  ).catch(
    (e) => new ContractPackageError({ detail: "write package.json", cause: e }),
  );
}
