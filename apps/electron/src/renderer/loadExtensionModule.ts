import * as maui from "maui";
import * as purseStyles from "purse-styles";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as JsxDevRuntime from "react/jsx-dev-runtime";
import * as JsxRuntime from "react/jsx-runtime";
import { evaluateExtensionSource } from "../shared/evaluateExtensionSource.ts";
import {
  extensionHostModules,
  type CompiledExtension,
} from "../shared/extension.ts";

const hostModules = {
  react: React,
  "react/jsx-runtime": JsxRuntime,
  "react/jsx-dev-runtime": JsxDevRuntime,
  "react-dom": ReactDOM,
  maui,
  "purse-styles": purseStyles,
} satisfies Record<(typeof extensionHostModules)[number], unknown>;

export function loadCompiledExtension(compiled: CompiledExtension) {
  return evaluateExtensionSource({
    id: compiled.id,
    source: compiled.source,
    requireModule: (moduleName: string) => {
      if (moduleName in hostModules) {
        return hostModules[moduleName as keyof typeof hostModules];
      }
      throw new Error(
        `Extension '${compiled.id}' imported unknown module '${moduleName}'`,
      );
    },
  });
}
