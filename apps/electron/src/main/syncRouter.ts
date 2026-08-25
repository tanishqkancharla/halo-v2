import { implement } from "@orpc/server";
import { AsyncEventQueue } from "@halo/plugin-sdk/shared";
import { contract } from "../shared/contract.js";
import type { HaloTandem } from "./HaloTandem.js";

export type SyncRouterContext = {
  tandem: HaloTandem;
};

const os = implement(contract.sync).$context<SyncRouterContext>();

export const syncRouter = os.router({
  push: os.push.handler(async ({ input, context }) => {
    await context.tandem.remote.push(input);
  }),
  pull: os.pull.handler(async ({ input, context }) => {
    return context.tandem.remote.pull(input);
  }),
  connect: os.connect.handler(async ({ input, context, signal }) => {
    const queue = new AsyncEventQueue<{ type: "poke" }>();
    const unsubscribe = await context.tandem.remote.connect({
      clientId: input.clientId,
      poke: () => {
        void queue.push({ type: "poke" });
      },
    });
    return (async function* () {
      try {
        yield* queue.values(signal);
      } finally {
        await unsubscribe();
      }
    })();
  }),
});
