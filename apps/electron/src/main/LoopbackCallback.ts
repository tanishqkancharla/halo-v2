import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import * as errore from "errore";

const loopbackHost = "127.0.0.1";
const callbackPath = "/oauth/callback";

export class LoopbackCallbackError extends errore.createTaggedError({
  name: "LoopbackCallbackError",
  message: "Halo could not $operation",
}) {}

export type LoopbackCallbackResult =
  | { code: string; state: string }
  | { providerError: string; state: string | undefined };

export type ListeningLoopbackCallback = {
  callbackUrl: string;
  result: Promise<LoopbackCallbackResult | LoopbackCallbackError>;
  close: () => Promise<undefined | LoopbackCallbackError>;
};

export async function listenForLoopbackCallback(input: { timeoutMs: number }) {
  return await new Promise<ListeningLoopbackCallback | LoopbackCallbackError>(
    (resolveListen) => {
      let resolveResult!: (
        result: LoopbackCallbackResult | LoopbackCallbackError,
      ) => void;
      const result = new Promise<
        LoopbackCallbackResult | LoopbackCallbackError
      >((resolve) => {
        resolveResult = resolve;
      });
      let timeout: NodeJS.Timeout | undefined;

      const server = createServer((request, response) => {
        receiveLoopbackCallback({ request, response, settle: resolveResult });
      });
      const listenError = (cause: Error) => {
        resolveListen(
          new LoopbackCallbackError({
            operation: "listen for the authorization callback",
            cause,
          }),
        );
      };

      server.once("error", listenError);
      server.listen(0, loopbackHost, () => {
        server.off("error", listenError);
        server.once("error", (cause) => {
          resolveResult(
            new LoopbackCallbackError({
              operation: "receive the authorization callback",
              cause,
            }),
          );
        });

        // SAFETY: Node returns a TCP address after successfully listening with a numeric port.
        const address = server.address() as AddressInfo;
        timeout = setTimeout(() => {
          resolveResult(
            new LoopbackCallbackError({
              operation: "wait for the authorization callback",
            }),
          );
        }, input.timeoutMs);

        resolveListen({
          callbackUrl: `http://${loopbackHost}:${address.port}${callbackPath}`,
          result,
          close: async () => {
            if (timeout !== undefined) clearTimeout(timeout);
            return await closeCallbackServer(server);
          },
        });
      });
    },
  );
}

function receiveLoopbackCallback(ctx: {
  request: IncomingMessage;
  response: ServerResponse;
  settle: (result: LoopbackCallbackResult | LoopbackCallbackError) => void;
}) {
  const url = new URL(
    ctx.request.url === undefined ? "/" : ctx.request.url,
    "http://127.0.0.1",
  );
  if (ctx.request.method !== "GET" || url.pathname !== callbackPath) {
    ctx.response.writeHead(404).end();
    return;
  }

  const providerError = url.searchParams.get("error");
  if (providerError !== null) {
    ctx.response
      .writeHead(400, { "content-type": "text/plain; charset=utf-8" })
      .end("Authorization was not completed.");
    const state = url.searchParams.get("state");
    ctx.settle({
      providerError,
      state: state === null ? undefined : state,
    });
    return;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (code === null || state === null) {
    ctx.response
      .writeHead(400, { "content-type": "text/plain; charset=utf-8" })
      .end("Missing OAuth callback parameters.");
    return;
  }

  ctx.response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
  });
  ctx.response.end(
    '<!doctype html><html><head><meta charset="utf-8"><title>Halo</title></head><body>You can close this tab.</body></html>',
  );
  ctx.settle({ code, state });
}

async function closeCallbackServer(server: HttpServer) {
  const closing = new Promise<undefined | LoopbackCallbackError>((resolve) => {
    server.close((cause) => {
      resolve(
        cause === undefined
          ? undefined
          : new LoopbackCallbackError({
              operation: "close the authorization callback",
              cause,
            }),
      );
    });
  });

  server.closeAllConnections();
  return await closing;
}
