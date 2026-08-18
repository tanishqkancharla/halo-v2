import type { PluginManifest } from "./pluginManifest.js";

export type PluginLoadError = {
  id: string;
  message: string;
};

export type PluginList = {
  plugins: PluginManifest[];
  errors: PluginLoadError[];
};
