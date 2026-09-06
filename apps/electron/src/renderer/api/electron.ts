import {
  connectHaloRpc,
  type HaloRpcConnectionError,
} from "./HaloRpcClient.js";
import type { HaloClient } from "@get-halo/shared/contract";
import type { DesktopApi } from "../../shared/desktop.js";

export const desktopApi: DesktopApi = window.haloDesktop;

export async function createElectronApi({
  onDisconnect,
}: {
  onDisconnect: (error: HaloRpcConnectionError) => void;
}): Promise<Error | HaloClient> {
  const connection = await desktopApi.getConnection();
  return connectHaloRpc({ connection, onDisconnect });
}
