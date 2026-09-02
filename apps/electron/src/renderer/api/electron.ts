import { connectHaloRpc } from "./HaloRpcClient.js";
import type { HaloClient } from "@get-halo/shared/contract";
import type { DesktopApi } from "../../shared/desktop.js";

let electronApiPromise: Promise<HaloClient> | undefined;

export const desktopApi: DesktopApi = window.haloDesktop;

export function createElectronApi(): Promise<HaloClient> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc();
  }
  return electronApiPromise;
}
