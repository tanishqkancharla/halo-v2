import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import {
  AuthService,
  DesktopAuthRequiredError,
  InvalidDesktopAuthCodeError,
} from "./AuthService.js";
import type { ControlPlaneConfig } from "./ControlPlaneConfig.js";
import {
  removeControlPlaneFile,
  writeControlPlaneFile,
} from "./ControlPlaneFile.js";

const loopbackHost = "127.0.0.1";
const cloudRunHost = "0.0.0.0";

class ControlPlaneHttpError extends errore.createTaggedError({
  name: "ControlPlaneHttpError",
  message: "Control plane HTTP failed: $detail",
}) {}

type ListeningControlPlaneHttp = {
  origin: string;
  server: HttpServer;
};

const desktopAuthStatePattern = /^[A-Za-z0-9_-]{32,128}$/u;
const desktopAuthExchangeSchema = Type.Object(
  { code: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

type DesktopSignInRequest = {
  callback: URL;
  state: string;
};

type DesktopAuthExchange = Static<typeof desktopAuthExchangeSchema>;

export class ControlPlane {
  private readonly appDataDir: string | undefined;
  private readonly auth: AuthService;
  private readonly publicOrigin: string;
  private readonly server: HttpServer;

  private constructor(ctx: {
    appDataDir: string | undefined;
    auth: AuthService;
    publicOrigin: string;
    server: HttpServer;
  }) {
    this.appDataDir = ctx.appDataDir;
    this.auth = ctx.auth;
    this.publicOrigin = ctx.publicOrigin;
    this.server = ctx.server;
  }

  get origin() {
    return this.publicOrigin;
  }

  static async start(options: ControlPlaneConfig) {
    await using cleanup = new errore.AsyncDisposableStack();
    const host = options.deployment === "local" ? loopbackHost : cloudRunHost;
    const listening = await listenControlPlaneHttp(host, options.port);
    if (listening instanceof Error) return listening;
    cleanup.defer(async () => {
      const closed = await closeControlPlaneHttp(listening.server);
      if (closed instanceof Error) console.error(closed);
    });
    const origin =
      options.deployment === "local" ? listening.origin : options.origin;
    if (options.deployment === "local") {
      const published = await writeControlPlaneFile({
        appDataDir: options.appDataDir,
        origin,
      });
      if (published instanceof Error) return published;
      cleanup.defer(async () => {
        const removed = await removeControlPlaneFile(options.appDataDir);
        if (removed instanceof Error) console.error(removed);
      });
    }
    const database =
      options.deployment === "local"
        ? {
            type: "sqlite" as const,
            path: join(options.appDataDir, "auth.db"),
          }
        : {
            type: "postgres" as const,
            connectionString: options.databaseUrl,
          };
    const auth = await AuthService.start({
      database,
      origin,
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
      appDataDir:
        options.deployment === "local" ? options.appDataDir : undefined,
      auth,
      publicOrigin: origin,
      server: listening.server,
    });
  }

  async close() {
    const httpClosed = await closeControlPlaneHttp(this.server);
    const authClosed = await this.auth.close();
    const removed =
      this.appDataDir === undefined
        ? undefined
        : await removeControlPlaneFile(this.appDataDir);
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
  if (request.method === "GET" && url.pathname === "/api/desktop-auth/start") {
    const signIn = parseDesktopSignInRequest(url);
    if (signIn === undefined) {
      response.writeHead(400).end("Invalid desktop sign-in request.");
      return;
    }
    const location = await auth.startDesktopSignIn(
      signIn.callback,
      signIn.state,
    );
    if (location instanceof Error) {
      console.error(location);
      response.writeHead(500).end();
      return;
    }
    response.writeHead(302, { location }).end();
    return;
  }
  if (
    request.method === "GET" &&
    url.pathname === "/api/desktop-auth/complete"
  ) {
    const signIn = parseDesktopSignInRequest(url);
    if (signIn === undefined) {
      response.writeHead(400).end("Invalid desktop sign-in request.");
      return;
    }
    const code = await auth.createDesktopAuthCode(requestHeaders(request));
    if (code instanceof DesktopAuthRequiredError) {
      response.writeHead(401).end("Google sign-in has not completed.");
      return;
    }
    if (code instanceof Error) {
      console.error(code);
      response.writeHead(500).end();
      return;
    }
    signIn.callback.searchParams.set("code", code);
    signIn.callback.searchParams.set("state", signIn.state);
    response
      .writeHead(302, {
        "cache-control": "no-store",
        location: signIn.callback.toString(),
        "referrer-policy": "no-referrer",
      })
      .end();
    return;
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/desktop-auth/exchange"
  ) {
    const code = await readDesktopAuthCode(request);
    if (code instanceof Error) {
      response.writeHead(400).end("Invalid desktop auth code.");
      return;
    }
    const session = await auth.exchangeDesktopAuthCode(code);
    if (session instanceof InvalidDesktopAuthCodeError) {
      response.writeHead(400).end("Desktop auth code is invalid or expired.");
      return;
    }
    if (session instanceof Error) {
      console.error(session);
      response.writeHead(500).end();
      return;
    }
    response
      .writeHead(200, {
        "cache-control": "no-store",
        "content-type": "application/json",
      })
      .end(JSON.stringify(session));
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

function parseDesktopSignInRequest(url: URL) {
  const callbackValue = url.searchParams.get("callback");
  const state = url.searchParams.get("state");
  if (callbackValue === null || state === null) return undefined;
  if (!desktopAuthStatePattern.test(state)) return undefined;
  const callback = errore.try({
    try: () => new URL(callbackValue),
    catch: () => new ControlPlaneHttpError({ detail: "invalid callback URL" }),
  });
  if (callback instanceof Error) return undefined;
  if (callback.protocol !== "http:") return undefined;
  if (callback.hostname !== loopbackHost) return undefined;
  if (callback.port === "") return undefined;
  if (callback.username !== "" || callback.password !== "") return undefined;
  if (callback.search !== "" || callback.hash !== "") return undefined;
  return { callback, state } satisfies DesktopSignInRequest;
}

function requestHeaders(request: IncomingMessage) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
      continue;
    }
    headers.set(name, value);
  }
  return headers;
}

function readDesktopAuthCode(request: IncomingMessage) {
  return new Promise<string | ControlPlaneHttpError>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = errore.try({
        try: (): DesktopAuthExchange | ControlPlaneHttpError => {
          const parsed: unknown = JSON.parse(
            Buffer.concat(chunks).toString("utf8"),
          );
          if (!Value.Check(desktopAuthExchangeSchema, parsed)) {
            return new ControlPlaneHttpError({ detail: "validate JSON body" });
          }
          return parsed;
        },
        catch: (cause) =>
          new ControlPlaneHttpError({ detail: "parse JSON body", cause }),
      });
      if (body instanceof Error) {
        resolve(body);
        return;
      }
      resolve(body.code);
    });
    request.on("error", (cause) => {
      resolve(
        new ControlPlaneHttpError({ detail: "read request body", cause }),
      );
    });
  });
}

function listenControlPlaneHttp(host: string, port: number) {
  const server = createServer(startingResponse);
  return new Promise<ListeningControlPlaneHttp | ControlPlaneHttpError>(
    (resolve) => {
      server.once("error", (error) => {
        resolve(
          new ControlPlaneHttpError({ detail: "listen failed", cause: error }),
        );
      });
      server.listen(port, host, () => {
        // SAFETY: Node returns a TCP address after successfully listening with a numeric port.
        const address = server.address() as AddressInfo;
        resolve({
          origin: `http://${host}:${address.port}`,
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
