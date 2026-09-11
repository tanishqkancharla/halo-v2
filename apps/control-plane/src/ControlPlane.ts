import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import * as errore from "errore";
import {
  removeControlPlaneFile,
  writeControlPlaneFile,
} from "./ControlPlaneFile.js";

const loopbackHost = "127.0.0.1";

type ControlPlaneOptions = {
  appDataDir: string;
  port: number;
};

class ControlPlaneHttpError extends errore.createTaggedError({
  name: "ControlPlaneHttpError",
  message: "Control plane HTTP failed: $detail",
}) {}

type ListeningControlPlaneHttp = {
  origin: string;
  server: HttpServer;
};

export class ControlPlane {
  private constructor(
    private readonly resources: {
      appDataDir: string;
      origin: string;
      server: HttpServer;
    },
  ) {}

  get origin() {
    return this.resources.origin;
  }

  static async start(options: ControlPlaneOptions) {
    await using cleanup = new errore.AsyncDisposableStack();
    const listening = await listenControlPlaneHttp(options.port);
    if (listening instanceof Error) return listening;
    cleanup.defer(async () => {
      const closed = await closeControlPlaneHttp(listening.server);
      if (closed instanceof Error) console.error(closed);
    });
    const published = await writeControlPlaneFile({
      appDataDir: options.appDataDir,
      origin: listening.origin,
    });
    if (published instanceof Error) return published;
    cleanup.move();
    return new ControlPlane({
      appDataDir: options.appDataDir,
      origin: listening.origin,
      server: listening.server,
    });
  }

  async close() {
    const httpClosed = await closeControlPlaneHttp(this.resources.server);
    const removed = await removeControlPlaneFile(this.resources.appDataDir);
    if (httpClosed instanceof Error) return httpClosed;
    if (removed instanceof Error) return removed;
  }
}

function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(
    request.url === undefined ? "/" : request.url,
    `http://${loopbackHost}`,
  );
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200).end();
    return;
  }
  response.writeHead(404).end();
}

function listenControlPlaneHttp(port: number) {
  const server = createServer(handleRequest);
  return new Promise<ListeningControlPlaneHttp | ControlPlaneHttpError>(
    (resolve) => {
      server.once("error", (error) => {
        resolve(
          new ControlPlaneHttpError({ detail: "listen failed", cause: error }),
        );
      });
      server.listen(port, loopbackHost, () => {
        // SAFETY: Node returns a TCP address after successfully listening with a numeric port.
        const address = server.address() as AddressInfo;
        resolve({
          origin: `http://${loopbackHost}:${address.port}`,
          server,
        });
      });
    },
  );
}

function closeControlPlaneHttp(server: HttpServer) {
  const closing = new Promise<undefined | ControlPlaneHttpError>((resolve) => {
    server.close((error) => {
      if (error !== undefined) {
        resolve(
          new ControlPlaneHttpError({ detail: "close failed", cause: error }),
        );
        return;
      }
      resolve(undefined);
    });
  });
  server.closeAllConnections();
  return closing;
}
