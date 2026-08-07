import { connectHaloRpc, type HaloApiStub } from "./HaloRpcClient.js";

let electronApiPromise: Promise<HaloApiStub> | undefined;

export function createElectronApi(): Promise<HaloApiStub> {
  if (electronApiPromise === undefined) {
    electronApiPromise = connectHaloRpc();
  }
  return electronApiPromise;
}
