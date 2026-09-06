import * as errore from "errore";

export class HaloRpcError extends errore.createTaggedError({
  name: "HaloRpcError",
  message: "RPC call failed: $detail",
}) {}

export function wrapRpc(error: { message: string }) {
  return new HaloRpcError({ detail: error.message, cause: error });
}
