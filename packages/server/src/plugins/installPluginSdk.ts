import { join } from "node:path";
import { writeContractPackage } from "@halo/plugin-sdk/contract";
import { pluginSdkDistDirectory } from "./sdkDist.js";

export async function installPluginSdkContract(args: {
  directory: string;
  appVersion: string;
}) {
  return await writeContractPackage({
    directory: join(args.directory, "node_modules", "@get-halo", "plugin-sdk"),
    version: args.appVersion,
    distDir: pluginSdkDistDirectory(),
  });
}
