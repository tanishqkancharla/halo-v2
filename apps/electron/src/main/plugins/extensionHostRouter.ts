import { os } from "@orpc/server";

export function createExtensionHostRouter() {
  return {
    ping: os.handler(async () => ({ ok: true as const })),
  };
}

export type ExtensionHostRouter = ReturnType<typeof createExtensionHostRouter>;
