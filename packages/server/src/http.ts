import crypto from "node:crypto";
import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { RPCHandler } from "@orpc/server/node";
import { CORSHandlerPlugin } from "@orpc/server/plugins";
import * as errore from "errore";
import { handleOAuthCallback } from "./oauth.js";
import { haloRpcRouter, type HaloContext } from "./router.js";
import { extensionToolRouter } from "./extensions/extensionsRouter.js";

type HaloHttpConnection = {
  host: string;
  port: number;
  token: string;
};

type HaloHttpConnections = {
  cli: HaloHttpConnection;
  renderer: HaloHttpConnection;
};

type ListeningHaloHttp = {
  connections: HaloHttpConnections;
  server: HttpServer;
  origin: string;
};

export class HaloHttpError extends errore.createTaggedError({
  name: "HaloHttpError",
  message: "Halo HTTP server failed: $detail",
}) {}

export async function listenHaloHttp(options: {
  host: string;
  port: number;
}): Promise<ListeningHaloHttp | HaloHttpError> {
  const server = createServer(startingResponse);
  const started = await listen(server, options);
  if (started instanceof Error) return started;
  // SAFETY: Node returns a TCP address after successfully listening with a numeric port.
  const address = server.address() as AddressInfo;
  return {
    server,
    origin: `http://${options.host}:${address.port}`,
    connections: {
      cli: {
        host: options.host,
        port: address.port,
        token: crypto.randomBytes(32).toString("base64url"),
      },
      renderer: {
        host: options.host,
        port: address.port,
        token: crypto.randomBytes(32).toString("base64url"),
      },
    },
  };
}

function startingResponse(_request: IncomingMessage, response: ServerResponse) {
  response.writeHead(503).end("Halo is starting.");
}

export function serveHaloHttp(options: {
  server: HttpServer;
  connections: HaloHttpConnections;
  context: HaloContext;
  corsOrigins: readonly string[];
}) {
  const cliToken = options.connections.cli.token;
  const rendererToken = options.connections.renderer.token;
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
  const extensionHandler = new RPCHandler(extensionToolRouter);
  options.server.removeListener("request", startingResponse);
  options.server.on("request", async (request, response) => {
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
    if (url.pathname.startsWith("/extension-tools/")) {
      const extensionId = options.context.extensions.identifyToolConnection(
        request.headers.authorization,
      );
      if (extensionId === undefined) {
        response.writeHead(401).end();
        return;
      }
      const handled = await extensionHandler.handle(request, response, {
        prefix: "/extension-tools",
        context: {
          extensionId,
          extensionTools: options.context.extensionTools,
        },
      });
      if (!handled.matched) response.writeHead(404).end();
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
      context: {
        ...options.context,
        browserControlAllowed:
          request.headers.authorization === `Bearer ${cliToken}`,
        extensionApprovalAllowed:
          request.headers.authorization === `Bearer ${rendererToken}`,
      },
    });
    if (handled.matched) return;
    response.statusCode = 404;
    response.end();
  });
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
