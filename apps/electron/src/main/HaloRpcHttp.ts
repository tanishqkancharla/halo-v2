import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { RPCHandler } from "@orpc/server/node";
import * as errore from "errore";
import { haloRpcRouter, type HaloContext } from "@get-halo/server/router";
import { removeHaloRpcFile, writeHaloRpcFile } from "./rpcFile.js";

export type HaloRpcHttp = {
  host: "127.0.0.1";
  port: number;
  token: string;
  oauthRedirectUri: string;
  close: () => Promise<void>;
};

export class HaloRpcHttpError extends errore.createTaggedError({
  name: "HaloRpcHttpError",
  message: "Halo RPC HTTP failed: $detail",
}) {}

export async function listenHaloRpcHttp(args: {
  context: HaloContext;
  userDataDir: string;
}): Promise<HaloRpcHttp | HaloRpcHttpError> {
  const token = randomBytes(32).toString("base64url");
  const handler = new RPCHandler<HaloContext>(haloRpcRouter);
  const server = createServer((req, res) => {
    // oxlint-disable-next-line typescript/no-floating-promises -- Node owns this synchronous request callback; handleRpcRequest writes the response.
    void handleRpcRequest({
      req,
      res,
      handler,
      context: args.context,
      token,
    });
  });

  const started = await listenLoopback(server);
  if (started instanceof Error) return started;

  const port = listenPort(server.address());
  if (port === undefined) {
    server.close();
    return new HaloRpcHttpError({ detail: "server has no TCP address" });
  }

  const file = await writeHaloRpcFile({
    userDataDir: args.userDataDir,
    connection: { port, token },
  });
  if (file instanceof Error) {
    server.close();
    return new HaloRpcHttpError({ detail: "write rpc.json", cause: file });
  }

  let closed = false;
  return {
    host: file.host,
    port: file.port,
    token,
    oauthRedirectUri: `http://${file.host}:${file.port}/oauth/callback`,
    close: async () => {
      if (closed) return;
      closed = true;
      const closedServer = await closeServer(server);
      if (closedServer instanceof Error) {
        console.warn("Could not close Halo RPC HTTP:", closedServer.message);
      }
      const removed = await removeHaloRpcFile({
        userDataDir: args.userDataDir,
      });
      if (removed instanceof Error) {
        console.warn("Could not unlink rpc.json:", removed.message);
      }
    },
  };
}

async function handleRpcRequest(args: {
  req: IncomingMessage;
  res: ServerResponse;
  handler: RPCHandler<HaloContext>;
  context: HaloContext;
  token: string;
}) {
  const url = new URL(
    args.req.url === undefined ? "/" : args.req.url,
    "http://127.0.0.1",
  );
  if (url.pathname === "/oauth/callback") {
    await handleOAuthCallback({
      url,
      req: args.req,
      res: args.res,
      context: args.context,
    });
    return;
  }

  if (args.req.headers.authorization !== `Bearer ${args.token}`) {
    args.res.statusCode = 401;
    args.res.end();
    return;
  }

  const handled = await args.handler
    .handle(args.req, args.res, {
      prefix: "/rpc",
      context: args.context,
    })
    .catch((e) => new HaloRpcHttpError({ detail: "request failed", cause: e }));
  if (handled instanceof Error) {
    args.context.logger.warn({ event: "orpc-http", error: handled });
    if (!args.res.writableEnded) {
      args.res.statusCode = 500;
      args.res.end();
    }
    return;
  }
  if (handled.matched) return;
  args.res.statusCode = 404;
  args.res.end();
}

async function handleOAuthCallback(args: {
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  context: HaloContext;
}) {
  if (args.req.method !== "GET") {
    args.res.statusCode = 405;
    args.res.end();
    return;
  }

  const providerError = args.url.searchParams.get("error");
  if (providerError !== null) {
    const state = args.url.searchParams.get("state");
    if (state !== null) {
      const cancelled = await args.context.toolRuntime.cancelOAuth(state);
      if (cancelled instanceof Error) {
        args.context.logger.warn({
          event: "oauth-cancel-failed",
          error: cancelled,
        });
      }
    }
    args.res.statusCode = 400;
    args.res.end("Authorization was not completed.");
    return;
  }

  const state = args.url.searchParams.get("state");
  const code = args.url.searchParams.get("code");
  if (state === null || code === null) {
    args.res.statusCode = 400;
    args.res.end("Missing OAuth callback parameters.");
    return;
  }

  const completed = await args.context.toolRuntime.completeOAuth({
    state,
    code,
  });
  if (completed instanceof Error) {
    args.context.logger.warn({
      event: "oauth-callback-failed",
      error: completed,
    });
    args.res.statusCode = 400;
    args.res.end("Authorization could not be completed.");
    return;
  }

  args.res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  args.res.end(
    '<!doctype html><html><head><meta charset="utf-8"><title>Halo</title></head><body>You can close this tab.</body></html>',
  );
}

function listenPort(address: string | AddressInfo | null) {
  if (address === null) return undefined;
  // SAFETY: listen(0, "127.0.0.1") is TCP; Node returns AddressInfo, not a pipe path.
  const tcp = address as AddressInfo;
  if (!Number.isInteger(tcp.port) || tcp.port <= 0) return undefined;
  return tcp.port;
}

function listenLoopback(server: ReturnType<typeof createServer>) {
  return new Promise<undefined | HaloRpcHttpError>((resolve) => {
    server.once("error", (e) => {
      resolve(new HaloRpcHttpError({ detail: e.message, cause: e }));
    });
    server.listen(0, "127.0.0.1", () => {
      resolve(undefined);
    });
  });
}

function closeServer(server: ReturnType<typeof createServer>) {
  server.closeAllConnections();
  return new Promise<undefined | HaloRpcHttpError>((resolve) => {
    server.close((e) => {
      if (e !== undefined) {
        resolve(new HaloRpcHttpError({ detail: e.message, cause: e }));
        return;
      }
      resolve(undefined);
    });
  });
}
