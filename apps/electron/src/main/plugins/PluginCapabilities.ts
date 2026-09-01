import type { ToolRuntimeService } from "../agent/runtime/ToolRuntimeService.js";
import type { PluginService } from "./PluginService.js";
import type { PluginToolGrants } from "./PluginToolGrants.js";

type PluginCapabilityReport = {
  requested: string[];
  existing: string[];
  granted: string[];
  missing: string[];
};

export async function checkPluginCapabilities(input: {
  pluginId: string;
  plugins: PluginService;
  pluginToolGrants: PluginToolGrants;
  toolRuntime: ToolRuntimeService;
}) {
  const manifest = await input.plugins.getManifest(input.pluginId);
  if (manifest instanceof Error) return manifest;
  const requested =
    manifest.halo.capabilities === undefined ? [] : manifest.halo.capabilities;
  const reconciled = await input.pluginToolGrants.reconcile({
    pluginId: input.pluginId,
    declaredPaths: requested,
  });
  if (reconciled instanceof Error) return reconciled;
  const runtime = await input.toolRuntime.get();
  if (runtime instanceof Error) return runtime;
  const catalog = await runtime.listToolPaths();
  if (catalog instanceof Error) return catalog;
  const catalogPaths = new Set(catalog);
  return {
    requested,
    existing: requested.filter((path) => catalogPaths.has(path)),
    granted: reconciled.granted,
    missing: requested.filter((path) => !catalogPaths.has(path)),
  } satisfies PluginCapabilityReport;
}

export async function grantPluginCapabilities(input: {
  pluginId: string;
  plugins: PluginService;
  pluginToolGrants: PluginToolGrants;
  toolRuntime: ToolRuntimeService;
}) {
  const checked = await checkPluginCapabilities(input);
  if (checked instanceof Error) return checked;
  const granted = await input.pluginToolGrants.grant({
    pluginId: input.pluginId,
    declaredPaths: checked.requested,
    grantPaths: checked.existing,
  });
  if (granted instanceof Error) return granted;
  return {
    requested: checked.requested,
    existing: checked.existing,
    granted: granted.granted,
    newlyGranted: granted.added,
    missing: checked.missing,
  };
}
