import type { ComponentType } from "react";
import type { PluginContributions } from "@halo/plugin-sdk/schema";
import type { PluginManifest } from "./pluginManifest.js";

export type PluginLoadError = {
  id: string;
  message: string;
};

export type CompiledPluginView = {
  id: string;
  source: string;
};

export type LoadedPluginView = {
  id: string;
  Sidebar?: ComponentType;
  Routes?: ComponentType;
};

export type PluginContributionDescriptor = {
  pluginId: string;
  contributes: PluginContributions;
};

export type PluginList = {
  plugins: PluginManifest[];
  contributions: PluginContributionDescriptor[];
  compiledViews: CompiledPluginView[];
  errors: PluginLoadError[];
};
