import crypto from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { RPCHandler } from "@orpc/server/node";
import * as errore from "errore";
import { haloRpcRouter, type HaloContext } from "./router.js";

export type HaloHttpConnection = {
  host: string;
  port: number;
  token: string;
};

type ListeningHaloHttp = {
  connection: HaloHttpConnection;
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
}): Promise<ListeningHaloHttp | HaloHttpError> {
  const token = crypto.randomBytes(32).toString("base64url");
  const handler = new RPCHandler<HaloContext>(haloRpcRouter);
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
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
  return {
    connection: { host: options.host, port: tcpAddress.port, token },
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
