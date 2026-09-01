import * as pluginSdkStorage from "@halo/plugin-sdk/storage";
import * as pluginSdkView from "@halo/plugin-sdk/view";
import * as errore from "errore";
import * as maui from "maui";
import * as purseStyles from "purse-styles";
import * as react from "react";
import * as jsxDevRuntime from "react/jsx-dev-runtime";
import * as jsxRuntime from "react/jsx-runtime";
import * as reactDom from "react-dom";
import type { ComponentType } from "react";
import * as wouter from "wouter";
import type { PluginList, PluginLoadError } from "@repo/shared/contract";
import { isCallable } from "../shared/isCallable.js";

export type LoadedPluginView = {
  id: string;
  Sidebar?: ComponentType;
  Routes?: ComponentType;
};

type PluginViewExports = {
  Sidebar?: ComponentType;
  Routes?: ComponentType;
  default?: PluginViewExports;
};

export class PluginViewEvaluateError extends errore.createTaggedError({
  name: "PluginViewEvaluateError",
  message: "Plugin '$id' view failed to evaluate: $detail",
}) {}

export type LoadedPluginList = {
  plugins: PluginList["plugins"];
  views: LoadedPluginView[];
  errors: PluginLoadError[];
};

export function loadPluginViews(list: PluginList): LoadedPluginList {
  const views: LoadedPluginView[] = [];
  const errors: PluginLoadError[] = [...list.errors];
  for (const compiled of list.compiledViews) {
    const loaded = evaluatePluginView(compiled);
    if (loaded instanceof Error) {
      errors.push({ id: compiled.id, message: loaded.message });
      continue;
    }
    views.push(loaded);
  }
  return { plugins: list.plugins, views, errors };
}

function evaluatePluginView(args: {
  id: string;
  source: string;
}): PluginViewEvaluateError | LoadedPluginView {
  const moduleExports: PluginViewExports = {};
  const cjs = { exports: moduleExports };
  const evaluated = errore.try({
    try: () => {
      const run = new Function(
        "exports",
        "require",
        "module",
        "__filename",
        "__dirname",
        args.source,
      );
      run(cjs.exports, requireHost, cjs, `${args.id}.js`, `/${args.id}`);
      return cjs.exports;
    },
    catch: (e) =>
      new PluginViewEvaluateError({
        id: args.id,
        detail: String(e),
        cause: e,
      }),
  });
  if (evaluated instanceof PluginViewEvaluateError) return evaluated;

  const exported = namedViewExports(evaluated);
  const Sidebar = componentExport(exported.Sidebar);
  const Routes = componentExport(exported.Routes);
  return { id: args.id, Sidebar, Routes };
}

function requireHost(specifier: string) {
  switch (specifier) {
    case "react":
      return react;
    case "react/jsx-runtime":
      return jsxRuntime;
    case "react/jsx-dev-runtime":
      return jsxDevRuntime;
    case "react-dom":
      return reactDom;
    case "maui":
      return maui;
    case "purse-styles":
      return purseStyles;
    case "wouter":
      return wouter;
    case "@get-halo/plugin-sdk/view":
      return pluginSdkView;
    case "@get-halo/plugin-sdk/storage":
      return pluginSdkStorage;
    default:
      throw new Error(`plugin view cannot require '${specifier}'`);
  }
}

function namedViewExports(moduleExports: PluginViewExports): PluginViewExports {
  if (hasViewExport(moduleExports)) return moduleExports;
  const nested = moduleExports.default;
  if (nested !== undefined && hasViewExport(nested)) return nested;
  return moduleExports;
}

function hasViewExport(record: PluginViewExports) {
  return record.Sidebar !== undefined || record.Routes !== undefined;
}

function componentExport(
  value: ComponentType | undefined,
): ComponentType | undefined {
  if (value === undefined) return undefined;
  if (!isCallable({ value })) return undefined;
  return value;
}
