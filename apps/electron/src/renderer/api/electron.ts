import { connectHaloRpc } from "./HaloRpcClient.js";
import type { HaloClient } from "@get-halo/shared/contract";

let electronApiPromise: Promise<HaloClient> | undefined;

export function createElectronApi(): Promise<HaloClient> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc();
  }
  return electronApiPromise;
}
