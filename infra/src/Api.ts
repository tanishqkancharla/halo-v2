import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export default Cloudflare.Worker(
  "Api",
  {
    main: import.meta.url,
  },
  Effect.succeed({
    fetch: Effect.succeed(HttpServerResponse.text("ok")),
  }),
);
