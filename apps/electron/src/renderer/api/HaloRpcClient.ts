import { newMessagePortRpcSession, type RpcStub } from "capnweb";
import { RPC_CHANNELS } from "../../shared/channels.js";
import type { HaloApi } from "../../shared/rpc.js";

export type HaloApiStub = RpcStub<HaloApi>;

export async function connectHaloRpc(): Promise<HaloApiStub> {
  const port = await requestRpcPort();
  return newMessagePortRpcSession<HaloApi>(port);
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
