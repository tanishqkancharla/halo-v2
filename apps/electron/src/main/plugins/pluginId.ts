import * as errore from "errore";
import { reservedPluginIds } from "../../shared/contract.js";

export class PluginIdError extends errore.createTaggedError({
  name: "PluginIdError",
  message: "Plugin id '$id' is invalid: $detail",
}) {}

export function parsePluginId(id: string) {
  if (id.length === 0) return new PluginIdError({ id, detail: "empty" });
  if (reservedPluginIdSet.has(id)) {
    return new PluginIdError({ id, detail: "reserved" });
  }
  if (!/^[a-z][a-z0-9-]*$/.test(id)) {
    return new PluginIdError({
      id,
      detail: "must match [a-z][a-z0-9-]*",
    });
  }
  return id;
}

const reservedPluginIdSet: ReadonlySet<string> = new Set(reservedPluginIds);
