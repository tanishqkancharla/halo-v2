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
import type { LoadedPluginView } from "../../shared/plugin.js";

const hostModules: Record<string, unknown> = {
  react,
  "react/jsx-runtime": jsxRuntime,
  "react/jsx-dev-runtime": jsxDevRuntime,
  "react-dom": reactDom,
  maui,
  "purse-styles": purseStyles,
  wouter,
  "@halo/plugin-sdk/view": pluginSdkView,
};

export class PluginViewEvaluateError extends errore.createTaggedError({
  name: "PluginViewEvaluateError",
  message: "Plugin '$id' view failed to evaluate: $detail",
}) {}

export class PluginViewExportError extends errore.createTaggedError({
  name: "PluginViewExportError",
  message: "Plugin '$id' view must export Sidebar and/or Routes",
}) {}

export function evaluatePluginView(args: {
  id: string;
  source: string;
}): PluginViewEvaluateError | PluginViewExportError | LoadedPluginView {
  const cjs = { exports: {} as unknown };
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
  if (Sidebar === undefined && Routes === undefined) {
    return new PluginViewExportError({ id: args.id });
  }

  return { id: args.id, Sidebar, Routes };
}

function requireHost(specifier: string) {
  const resolved = hostModules[specifier];
  if (resolved === undefined) {
    throw new Error(`plugin view cannot require '${specifier}'`);
  }
  return resolved;
}

function namedViewExports(moduleExports: unknown): Record<string, unknown> {
  if (typeof moduleExports !== "object" || moduleExports === null) {
    return {};
  }
  const record = moduleExports as Record<string, unknown>;
  if (hasViewExport(record)) return record;
  const nested = record.default;
  if (typeof nested === "object" && nested !== null) {
    const nestedRecord = nested as Record<string, unknown>;
    if (hasViewExport(nestedRecord)) return nestedRecord;
  }
  return record;
}

function hasViewExport(record: Record<string, unknown>) {
  return "Sidebar" in record || "Routes" in record;
}

function componentExport(value: unknown): ComponentType | undefined {
  if (typeof value === "function") return value as ComponentType;
  return undefined;
}
