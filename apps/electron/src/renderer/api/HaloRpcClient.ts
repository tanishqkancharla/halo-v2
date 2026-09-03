import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import * as errore from "errore";
import {
  haloProtocolVersion,
  type HaloClient,
} from "@get-halo/shared/contract";
import type { HaloRpcConnection } from "../../shared/rpc.js";

export class HaloRpcConnectionError extends errore.createTaggedError({
  name: "HaloRpcConnectionError",
  message: "Halo could not connect to its server.",
}) {}

export class IncompatibleServerError extends errore.createTaggedError({
  name: "IncompatibleServerError",
  message:
    "Halo protocol $clientProtocolVersion cannot use server protocol $serverProtocolVersion.",
}) {}

export async function connectHaloRpc(
  connection: HaloRpcConnection,
): Promise<Error | HaloClient> {
  const link = new RPCLink({
    origin: connection.origin,
    url: "/rpc",
    headers: { authorization: `Bearer ${connection.token}` },
  });
  // SAFETY: HaloRpcConnection points to the Halo router.
  const client = createORPCClient(link) as HaloClient;
  const info = await client.server
    .info()
    .catch((cause) => new HaloRpcConnectionError({ cause }));
  if (info instanceof Error) return info;
  if (info.protocolVersion !== haloProtocolVersion) {
    return new IncompatibleServerError({
      clientProtocolVersion: haloProtocolVersion,
      serverProtocolVersion: info.protocolVersion,
    });
  }
  return client;
}
