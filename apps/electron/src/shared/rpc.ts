export type HaloRpcConnection = {
  origin: string;
  token: string;
};

declare global {
  interface Window {
    haloRpc: HaloRpcConnection;
  }
}
