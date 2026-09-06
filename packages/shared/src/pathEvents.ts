import type { WorkspaceTreeEvent } from "./rpc.js";

export function applyPathEvents(
  paths: string[],
  events: readonly WorkspaceTreeEvent[],
) {
  return events.reduce((next, event) => {
    if (event.type === "create") {
      if (next.includes(event.path)) return next;
      return [...next, event.path];
    }
    return next.filter((path) => {
      if (path === event.path) return false;
      const prefix = event.path.endsWith("/") ? event.path : `${event.path}/`;
      return !path.startsWith(prefix);
    });
  }, paths);
}
