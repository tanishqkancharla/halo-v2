import { connectHaloRpc } from "./HaloRpcClient.js";
import type { HaloClient } from "../../shared/contract.js";

let electronApiPromise: Promise<HaloClient> | undefined;

export function createElectronApi(): Promise<HaloClient> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc();
  }
  return electronApiPromise;
}
