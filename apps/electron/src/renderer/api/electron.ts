import { systemApiFromHaloRpc, connectHaloRpc } from "./halo-rpc-client.js";
import type { SystemApi } from "./SystemApi.js";

let electronApiPromise: Promise<SystemApi> | undefined;

export function getElectronApi(): Promise<SystemApi> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc().then(systemApiFromHaloRpc);
  }
  return electronApiPromise;
}
