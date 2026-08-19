export const RPC_CHANNELS = {
  requestRpc: "halo:request-rpc",
  provideRpc: "halo:provide-rpc",
} as const;

export const PLUGIN_RPC_CHANNELS = {
  requestRpc: "halo:request-plugin-rpc",
  provideRpc: "halo:provide-plugin-rpc",
} as const;

export const LOG_CHANNELS = {
  log: "halo:log",
} as const;
