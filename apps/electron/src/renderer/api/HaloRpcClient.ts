import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { HaloClient } from "@get-halo/shared/contract";
import type { HaloRpcConnection } from "../../shared/rpc.js";

export async function connectHaloRpc(
  connection: HaloRpcConnection,
): Promise<HaloClient> {
  const link = new RPCLink({
    origin: connection.origin,
    url: "/rpc",
    headers: { authorization: `Bearer ${connection.token}` },
  });
  // SAFETY: HaloRpcConnection points to the Halo router.
  return createORPCClient(link) as HaloClient;
}
