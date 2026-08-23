import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { HaloRpcFile } from "./rpcFile.js";

export function createHaloRpcClient<T>(file: HaloRpcFile): T {
  const link = new RPCLink({
    origin: `http://${file.host}:${file.port}`,
    url: "/rpc",
    headers: { authorization: `Bearer ${file.token}` },
  });
  // SAFETY: the caller supplies the Halo contract client type.
  return createORPCClient(link) as T;
}
