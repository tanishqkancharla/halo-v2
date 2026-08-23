import type { ComponentType } from "react";
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

export type PluginList = {
  plugins: PluginManifest[];
  compiledViews: CompiledPluginView[];
  errors: PluginLoadError[];
};

export type PluginBuildResult = {
  built: string[];
  errors: PluginLoadError[];
};
