import type { HaloManifest } from "@halo/plugin-sdk/schema";
import * as errore from "errore";

export type PluginManifest = {
  id: string;
  directory: string;
  packageName: string;
  halo: HaloManifest;
  viewPath?: string;
  serverPath?: string;
};

export class PluginManifestError extends errore.createTaggedError({
  name: "PluginManifestError",
  message: "Plugin '$id' package.json is not a Halo plugin: $detail",
}) {}
