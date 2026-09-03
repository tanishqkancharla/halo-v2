import {
  connectHaloRpc,
  type HaloRpcConnectionError,
} from "./HaloRpcClient.js";
import type { HaloClient } from "@get-halo/shared/contract";
import type { DesktopApi } from "../../shared/desktop.js";

export const desktopApi: DesktopApi = window.haloDesktop;

export function createElectronApi({
  onDisconnect,
}: {
  onDisconnect: (error: HaloRpcConnectionError) => void;
}): Promise<Error | HaloClient> {
  return connectHaloRpc({
    connection: window.haloRpc,
    onDisconnect,
  });
}
