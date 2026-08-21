import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { type RouterClient } from "@orpc/server";
import { RPC_CHANNELS } from "../../shared/channels.js";
import type { ExtensionHostRouter } from "../../main/plugins/extensionHostRouter.js";
import { requestWindowPort } from "./requestWindowPort.js";

export type ExtensionHostClient = RouterClient<ExtensionHostRouter>;

let clientPromise: Promise<ExtensionHostClient> | undefined;

export function connectExtensionHostRpc(): Promise<ExtensionHostClient> {
  if (clientPromise === undefined) {
    clientPromise = openClient();
  }
  return clientPromise;
}

async function openClient(): Promise<ExtensionHostClient> {
  const port = await requestWindowPort({
    request: RPC_CHANNELS.requestExtensionHost,
    provide: RPC_CHANNELS.provideExtensionHost,
  });
  const link = new RPCLink({ port });
  const client: ExtensionHostClient = createORPCClient(link);
  port.start();
  return client;
}
