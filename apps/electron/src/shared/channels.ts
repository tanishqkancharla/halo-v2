export const RPC_CHANNELS = {
  requestRpc: "halo:request-rpc",
  provideRpc: "halo:provide-rpc",
  requestExtensionHost: "halo:request-extension-host",
  provideExtensionHost: "halo:provide-extension-host",
} as const;

export const LOG_CHANNELS = {
  log: "halo:log",
} as const;
