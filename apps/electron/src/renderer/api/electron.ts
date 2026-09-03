import { connectHaloRpc } from "./HaloRpcClient.js";
import type { HaloClient } from "@get-halo/shared/contract";
import type { DesktopApi } from "../../shared/desktop.js";

let electronApiPromise: Promise<Error | HaloClient> | undefined;

export const desktopApi: DesktopApi = window.haloDesktop;

export function createElectronApi(): Promise<Error | HaloClient> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc(window.haloRpc);
  }
  return electronApiPromise;
}
