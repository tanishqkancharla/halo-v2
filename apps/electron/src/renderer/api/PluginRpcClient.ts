import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { AnyRouter, RouterClient } from "@orpc/server";
import { PLUGIN_RPC_CHANNELS } from "../../shared/channels.js";

export type PluginHostClient = {
  [pluginId: string]: RouterClient<AnyRouter>;
};

let pluginClient: PluginHostClient | undefined;

export async function connectPluginRpc(): Promise<PluginHostClient> {
  if (pluginClient !== undefined) return pluginClient;
  const { port1: clientPort, port2: serverPort } = new MessageChannel();
  window.postMessage(PLUGIN_RPC_CHANNELS.requestRpc, "*", [serverPort]);
  const link = new RPCLink({ port: clientPort });
  clientPort.start();
  pluginClient = createORPCClient(link) as PluginHostClient;
  return pluginClient;
}

export function getPluginRpcClient(): PluginHostClient | undefined {
  return pluginClient;
}
