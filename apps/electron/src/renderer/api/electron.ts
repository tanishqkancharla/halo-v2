import { systemApiFromHaloRpc, connectHaloRpc } from "./HaloRpcClient.js";
import type { SystemApi } from "./SystemApi.js";

let electronApiPromise: Promise<SystemApi> | undefined;

export function createElectronApi(): Promise<SystemApi> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc().then(systemApiFromHaloRpc);
  }
  return electronApiPromise;
}
