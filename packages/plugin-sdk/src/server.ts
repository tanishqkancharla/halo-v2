import { os as baseOs, ORPCError } from "@orpc/server";

export type PluginServerContext = {
  pluginId: string;
  workspaceRoot: string;
};

export const os = baseOs.$context<PluginServerContext>();
export { ORPCError };
