import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contractPackageName } from "@halo/plugin-sdk/contract";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";

export class PluginSdkPinError extends errore.createTaggedError({
  name: "PluginSdkPinError",
  message:
    "Plugin '$id' @get-halo/plugin-sdk pin is $pin; this Halo is $appVersion",
}) {}

export class PluginSdkPinMissingError extends errore.createTaggedError({
  name: "PluginSdkPinMissingError",
  message: "Plugin '$id' must pin @get-halo/plugin-sdk to $appVersion exactly",
}) {}

export class PluginSdkPinReadError extends errore.createTaggedError({
  name: "PluginSdkPinReadError",
  message: "Plugin '$id' package.json could not be read",
}) {}

const pluginSdkPinPackageSchema = Type.Object({
  devDependencies: Type.Optional(Type.Record(Type.String(), Type.String())),
});

type PluginSdkPinPackage = Static<typeof pluginSdkPinPackageSchema>;

export function readPluginSdkPin(
  packageJson: PluginSdkPinPackage,
): string | undefined {
  const deps = packageJson.devDependencies;
  if (deps === undefined) return undefined;
  return deps[contractPackageName];
}

export function assertPluginSdkPin(args: {
  id: string;
  pin: string | undefined;
  appVersion: string;
}) {
  if (args.pin === undefined) {
    return new PluginSdkPinMissingError({
      id: args.id,
      appVersion: args.appVersion,
    });
  }
  if (args.pin !== args.appVersion) {
    return new PluginSdkPinError({
      id: args.id,
      pin: args.pin,
      appVersion: args.appVersion,
    });
  }
  return undefined;
}

export async function readPluginSdkPinFile(args: {
  id: string;
  directory: string;
}) {
  const raw = await readFile(
    join(args.directory, "package.json"),
    "utf8",
  ).catch((e) => new PluginSdkPinReadError({ id: args.id, cause: e }));
  if (raw instanceof Error) return raw;

  const parsed = errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; pluginSdkPinPackageSchema is the file contract.
      return JSON.parse(raw) as unknown;
    },
    catch: (e) => new PluginSdkPinReadError({ id: args.id, cause: e }),
  });
  if (parsed instanceof Error) return parsed;
  if (!Value.Check(pluginSdkPinPackageSchema, parsed)) return undefined;
  return readPluginSdkPin(parsed);
}
