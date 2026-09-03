import crypto from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { RPCHandler } from "@orpc/server/node";
import { CORSHandlerPlugin } from "@orpc/server/plugins";
import * as errore from "errore";
import { handleOAuthCallback } from "./oauth.js";
import { haloRpcRouter, type HaloContext } from "./router.js";

type HaloHttpConnection = {
  host: string;
  port: number;
  token: string;
};

export type HaloHttpConnections = {
  cli: HaloHttpConnection;
  renderer: HaloHttpConnection;
};

type ListeningHaloHttp = {
  connections: HaloHttpConnections;
  server: HttpServer;
};

export class HaloHttpError extends errore.createTaggedError({
  name: "HaloHttpError",
  message: "Halo HTTP server failed: $detail",
}) {}

export async function listenHaloHttp(options: {
  context: HaloContext;
  host: string;
  port: number;
  corsOrigins: readonly string[];
}): Promise<ListeningHaloHttp | HaloHttpError> {
  const cliToken = crypto.randomBytes(32).toString("base64url");
  const rendererToken = crypto.randomBytes(32).toString("base64url");
  const authorizations = new Set([
    `Bearer ${cliToken}`,
    `Bearer ${rendererToken}`,
  ]);
  const isAuthorized = (authorization: string | undefined) => {
    if (authorization === undefined) return false;
    return authorizations.has(authorization);
  };
  const handler = new RPCHandler<HaloContext>(haloRpcRouter, {
    plugins: [
      new CORSHandlerPlugin({
        origin: options.corsOrigins,
        allowHeaders: ["authorization", "content-type"],
      }),
    ],
  });
  const server = createServer(async (request, response) => {
    const url = new URL(
      request.url === undefined ? "/" : request.url,
      "http://localhost",
    );
    if (url.pathname === "/oauth/callback") {
      await handleOAuthCallback({
        url,
        request,
        response,
        context: options.context,
      });
      return;
    }
    if (
      request.method !== "OPTIONS" &&
      !isAuthorized(request.headers.authorization)
    ) {
      response.statusCode = 401;
      response.end();
      return;
    }
    const handled = await handler.handle(request, response, {
      prefix: "/rpc",
      context: options.context,
    });
    if (handled.matched) return;
    response.statusCode = 404;
    response.end();
  });
  const started = await listen(server, options);
  if (started instanceof Error) return started;

  const address = server.address();
  if (address === null) {
    server.close();
    return new HaloHttpError({ detail: "server has no TCP address" });
  }
  // SAFETY: listen receives a numeric port and host, so Node returns AddressInfo instead of a pipe name.
  const tcpAddress = address as AddressInfo;
  options.context.toolRuntime.setOAuthRedirectUri(
    `http://${options.host}:${tcpAddress.port}/oauth/callback`,
  );
  return {
    connections: {
      cli: { host: options.host, port: tcpAddress.port, token: cliToken },
      renderer: {
        host: options.host,
        port: tcpAddress.port,
        token: rendererToken,
      },
    },
    server,
  };
}

export function closeHaloHttp(server: HttpServer) {
  server.closeAllConnections();
  return new Promise<undefined | HaloHttpError>((resolve) => {
    server.close((error) => {
      if (error !== undefined) {
        resolve(new HaloHttpError({ detail: "close failed", cause: error }));
        return;
      }
      resolve(undefined);
    });
  });
}

function listen(server: HttpServer, options: { host: string; port: number }) {
  return new Promise<undefined | HaloHttpError>((resolve) => {
    server.once("error", (error) => {
      resolve(new HaloHttpError({ detail: "listen failed", cause: error }));
    });
    server.listen(options.port, options.host, () => resolve(undefined));
  });
}
