import type { RemoteApi } from "@tandem/types";
import type { HaloClient } from "../../shared/contract.js";
import type { HaloSchema } from "../../shared/HaloTables.ts";

export function haloSyncRemote(
  sync: HaloClient["sync"],
): RemoteApi<HaloSchema> {
  return {
    push: async (args) => {
      await sync.push(args);
    },
    pull: async (args) => {
      return sync.pull(args);
    },
    connect: async ({ clientId, poke }) => {
      const controller = new AbortController();
      const iterator = await sync.connect(
        { clientId },
        { signal: controller.signal },
      );
      void (async () => {
        for await (const event of iterator) {
          if (event.type === "poke") poke();
        }
      })();
      return async () => {
        controller.abort();
        void iterator.return?.(undefined);
      };
    },
  };
}
