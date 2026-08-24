import { join } from "node:path";
import { writeContractPackage } from "@halo/plugin-sdk/contract";
import { bundledTypesDirectory } from "./bundledTypes.js";

export async function installPluginSdkContract(args: {
  directory: string;
  appVersion: string;
}) {
  return writeContractPackage({
    directory: join(args.directory, "node_modules", "@get-halo", "plugin-sdk"),
    version: args.appVersion,
    bundledTypesDir: bundledTypesDirectory(),
  });
}
