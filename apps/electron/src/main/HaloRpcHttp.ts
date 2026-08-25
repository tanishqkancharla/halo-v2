import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { RPCHandler } from "@orpc/server/node";
import { rpcFilePath, type HaloRpcFile } from "@halo/cli";
import * as errore from "errore";
import { haloRpcRouter, type HaloContext } from "./router.js";

export type HaloRpcHttp = {
  host: "127.0.0.1";
  port: number;
  token: string;
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

  const file: HaloRpcFile = {
    version: 1,
    host: "127.0.0.1",
    port,
    token,
  };
  const path = rpcFilePath(args.userDataDir);
  const written = await writeFile(path, `${JSON.stringify(file)}\n`, {
    mode: 0o600,
  }).catch((e) => new HaloRpcHttpError({ detail: "write rpc.json", cause: e }));
  if (written instanceof Error) {
    server.close();
    return written;
  }

  let closed = false;
  return {
    host: file.host,
    port: file.port,
    token,
    close: async () => {
      if (closed) return;
      closed = true;
      const closedServer = await closeServer(server);
      if (closedServer instanceof Error) {
        console.warn("Could not close Halo RPC HTTP:", closedServer.message);
      }
      if (!existsSync(path)) return;
      const removed = await unlink(path).catch(
        (e) => new HaloRpcHttpError({ detail: "unlink rpc.json", cause: e }),
      );
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
