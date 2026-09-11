import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import * as errore from "errore";
import { AuthService } from "./AuthService.js";
import type { ControlPlaneConfig } from "./ControlPlaneConfig.js";
import {
  removeControlPlaneFile,
  writeControlPlaneFile,
} from "./ControlPlaneFile.js";

const loopbackHost = "127.0.0.1";

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
      auth: AuthService;
      origin: string;
      server: HttpServer;
    },
  ) {}

  get origin() {
    return this.resources.origin;
  }

  static async start(options: ControlPlaneConfig) {
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
    const auth = await AuthService.start({
      appDataDir: options.appDataDir,
      origin: listening.origin,
      secret: options.auth.secret,
      googleClientId: options.auth.googleClientId,
      googleClientSecret: options.auth.googleClientSecret,
    });
    if (auth instanceof Error) return auth;
    cleanup.defer(async () => {
      const closed = await auth.close();
      if (closed instanceof Error) console.error(closed);
    });
    serveControlPlaneHttp(listening.server, auth);
    cleanup.move();
    return new ControlPlane({
      appDataDir: options.appDataDir,
      auth,
      origin: listening.origin,
      server: listening.server,
    });
  }

  async close() {
    const httpClosed = await closeControlPlaneHttp(this.resources.server);
    const authClosed = await this.resources.auth.close();
    const removed = await removeControlPlaneFile(this.resources.appDataDir);
    if (httpClosed instanceof Error) return httpClosed;
    if (authClosed instanceof Error) return authClosed;
    if (removed instanceof Error) return removed;
  }
}

function startingResponse(_request: IncomingMessage, response: ServerResponse) {
  response.writeHead(503).end("Control plane is starting.");
}

function serveControlPlaneHttp(server: HttpServer, auth: AuthService) {
  server.removeAllListeners("request");
  server.on("request", async (request, response) => {
    await handleRequest(request, response, auth);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  auth: AuthService,
) {
  const url = new URL(
    request.url === undefined ? "/" : request.url,
    `http://${loopbackHost}`,
  );
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200).end();
    return;
  }
  if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
    const handled = await auth.handleHttp(request, response);
    if (handled instanceof Error) {
      console.error(handled);
      if (!response.writableEnded) response.writeHead(500).end();
    }
    return;
  }
  response.writeHead(404).end();
}

function listenControlPlaneHttp(port: number) {
  const server = createServer(startingResponse);
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
