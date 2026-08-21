import { newMessagePortRpcSession, type RpcStub } from "capnweb";
import { RPC_CHANNELS } from "../../shared/channels.js";
import type { HaloApi } from "../../shared/rpc.js";
import { requestWindowPort } from "./requestWindowPort.js";

export type HaloApiStub = RpcStub<HaloApi>;

export async function connectHaloRpc(): Promise<HaloApiStub> {
  const port = await requestWindowPort({
    request: RPC_CHANNELS.requestRpc,
    provide: RPC_CHANNELS.provideRpc,
  });
  return newMessagePortRpcSession<HaloApi>(port);
}
