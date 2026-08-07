import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { Releases } from "./src/Releases.ts";
import { SecretsStore } from "./src/SecretsStore.ts";

export default Alchemy.Stack(
  "Halo",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const secretsStore = yield* SecretsStore;
    const releases = yield* Releases;

    return {
      secretsStoreId: secretsStore.storeId,
      secretsStoreName: secretsStore.storeName,
      releasesBucket: releases.bucketName,
    };
  }),
);
