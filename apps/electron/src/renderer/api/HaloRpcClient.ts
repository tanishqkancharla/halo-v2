import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { RPC_CHANNELS } from "../../shared/channels.js";
import type { HaloClient } from "@repo/shared/contract";

export async function connectHaloRpc(): Promise<HaloClient> {
  const port = await requestRpcPort();
  const link = new RPCLink({ port });
  port.start();
  // SAFETY: this port is upgraded to the Halo router; HaloClient is that contract plus plugins.
  return createORPCClient(link) as HaloClient;
}

function requestRpcPort(): Promise<MessagePort> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data !== RPC_CHANNELS.provideRpc) return;
      window.removeEventListener("message", onMessage);
      resolve(event.ports[0]!);
    };
    window.addEventListener("message", onMessage);
    window.postMessage(RPC_CHANNELS.requestRpc, "*");
  });
}
