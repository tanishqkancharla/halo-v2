import * as errore from "errore";
import type { ComponentType } from "react";
import type { SidebarItem, SidebarSection } from "./extension.ts";

export class ExtensionEvaluateError extends errore.createTaggedError({
  name: "ExtensionEvaluateError",
  message: "Failed to evaluate extension '$id'",
}) {}

export class ExtensionExportError extends errore.createTaggedError({
  name: "ExtensionExportError",
  message: "Extension '$id' must default-export { sidebarEntries, views }",
}) {}

export type LoadedExtension = {
  id: string;
  sidebarEntries: SidebarSection[];
  views: Record<string, ComponentType>;
};

export type ExtensionRequire = (moduleName: string) => unknown;

export function evaluateExtensionSource({
  id,
  source,
  requireModule,
}: {
  id: string;
  source: string;
  requireModule: ExtensionRequire;
}) {
  const cjsModule = { exports: {} as unknown };
  const evaluated = errore.try({
    try: () => {
      const run = new Function("module", "exports", "require", source) as (
        moduleObject: { exports: unknown },
        exports: unknown,
        requireModule: ExtensionRequire,
      ) => void;
      run(cjsModule, cjsModule.exports, requireModule);
      return cjsModule.exports;
    },
    catch: (e) => new ExtensionEvaluateError({ id, cause: e }),
  });
  if (evaluated instanceof Error) return evaluated;
  return parseLoadedExtension(id, evaluated);
}

export function parseLoadedExtension(id: string, exported: unknown) {
  const record = asRecord(exported);
  if (record === undefined) return new ExtensionExportError({ id });

  const defaultExport = record.default;
  const defaultRecord = asRecord(defaultExport);
  if (defaultRecord !== undefined && hasExtensionShape(defaultRecord)) {
    return readExtension(id, defaultRecord);
  }
  if (hasExtensionShape(record)) return readExtension(id, record);
  return new ExtensionExportError({ id });
}

function readExtension(id: string, record: Record<string, unknown>) {
  const sidebarEntries = readSidebarEntries(record.sidebarEntries);
  if (sidebarEntries instanceof Error) return new ExtensionExportError({ id });

  const views = readViews(record.views);
  if (views instanceof Error) return new ExtensionExportError({ id });

  return { id, sidebarEntries, views };
}

function hasExtensionShape(record: Record<string, unknown>) {
  return "sidebarEntries" in record || "views" in record;
}

function readSidebarEntries(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return new Error("sidebarEntries");
  const sections: SidebarSection[] = [];
  for (const entry of value) {
    const section = readSidebarSection(entry);
    if (section instanceof Error) return section;
    sections.push(section);
  }
  return sections;
}

function readSidebarSection(value: unknown) {
  const record = asRecord(value);
  if (record === undefined) return new Error("section");
  if (typeof record.id !== "string" || record.id.length === 0) {
    return new Error("section.id");
  }
  if (typeof record.label !== "string" || record.label.length === 0) {
    return new Error("section.label");
  }
  if (!Array.isArray(record.items)) return new Error("section.items");
  const items: SidebarItem[] = [];
  for (const item of record.items) {
    const parsed = readSidebarItem(item);
    if (parsed instanceof Error) return parsed;
    items.push(parsed);
  }
  return { id: record.id, label: record.label, items };
}

function readSidebarItem(value: unknown) {
  const record = asRecord(value);
  if (record === undefined) return new Error("item");
  if (typeof record.id !== "string" || record.id.length === 0) {
    return new Error("item.id");
  }
  if (typeof record.label !== "string" || record.label.length === 0) {
    return new Error("item.label");
  }
  if (typeof record.viewId !== "string" || record.viewId.length === 0) {
    return new Error("item.viewId");
  }
  return { id: record.id, label: record.label, viewId: record.viewId };
}

function readViews(value: unknown) {
  if (value === undefined) return {};
  const record = asRecord(value);
  if (record === undefined) return new Error("views");
  const views: Record<string, ComponentType> = {};
  for (const [viewId, component] of Object.entries(record)) {
    if (typeof component !== "function") return new Error("views");
    views[viewId] = component as ComponentType;
  }
  return views;
}

function asRecord(value: unknown) {
  if (typeof value !== "object") return undefined;
  if (value === null) return undefined;
  if (Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
