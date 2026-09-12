import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { isAPIError } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { toNodeHandler } from "better-auth/node";
import { bearer, oneTimeToken } from "better-auth/plugins";
import * as errore from "errore";
import { Pool } from "pg";

const loopbackHost = "127.0.0.1";
const desktopAuthStatePattern = /^[A-Za-z0-9_-]{32,128}$/u;

class AuthServiceError extends errore.createTaggedError({
  name: "AuthServiceError",
  message: "Auth service failed: $detail",
}) {}

export class InvalidDesktopSignInRequestError extends errore.createTaggedError({
  name: "InvalidDesktopSignInRequestError",
  message: "Desktop sign-in callback or state is invalid",
}) {}

export class DesktopAuthRequiredError extends errore.createTaggedError({
  name: "DesktopAuthRequiredError",
  message: "Google sign-in has not completed",
}) {}

export class InvalidDesktopAuthCodeError extends errore.createTaggedError({
  name: "InvalidDesktopAuthCodeError",
  message: "Desktop sign-in code is invalid or expired",
}) {}

export type AuthDatabaseConfig =
  | { type: "sqlite"; path: string }
  | { type: "postgres"; connectionString: string };

type AuthServiceOptions = {
  database: AuthDatabaseConfig;
  origin: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
};

type DesktopSignInRequest = {
  callback: string;
  state: string;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  image: string | undefined;
};

export type AuthSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: AuthUser;
};

type DesktopAuthSession = AuthSession & {
  token: string;
};

type AuthDatabase = DatabaseSync | Pool;
type NodeHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

function authOptions(options: AuthServiceOptions, database: AuthDatabase) {
  return {
    baseURL: options.origin,
    secret: options.secret,
    database,
    trustedOrigins: [options.origin],
    socialProviders: {
      google: {
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
      },
    },
    plugins: [
      bearer(),
      oneTimeToken({
        disableClientRequest: true,
        expiresIn: 1,
        storeToken: "hashed",
      }),
    ],
  } satisfies BetterAuthOptions;
}

type AuthInstance = Auth<ReturnType<typeof authOptions>>;

export class AuthService {
  private readonly auth: AuthInstance;
  private readonly database: AuthDatabase;
  private readonly nodeHandler: NodeHandler;
  private readonly origin: string;

  private constructor(ctx: {
    auth: AuthInstance;
    database: AuthDatabase;
    nodeHandler: NodeHandler;
    origin: string;
  }) {
    this.auth = ctx.auth;
    this.database = ctx.database;
    this.nodeHandler = ctx.nodeHandler;
    this.origin = ctx.origin;
  }

  static async start(options: AuthServiceOptions) {
    await using cleanup = new errore.AsyncDisposableStack();

    const database = await openDatabase(options.database);
    if (database instanceof Error) return database;

    cleanup.defer(async () => {
      const closed = await closeDatabase(database);
      if (closed instanceof Error) console.error(closed);
    });

    const config = authOptions(options, database);
    const migrations = await getMigrations(config).catch(
      (cause) => new AuthServiceError({ detail: "prepare migrations", cause }),
    );
    if (migrations instanceof Error) return migrations;

    const migrated = await migrations
      .runMigrations()
      .catch(
        (cause) => new AuthServiceError({ detail: "run migrations", cause }),
      );
    if (migrated instanceof Error) return migrated;

    const auth = betterAuth(config);

    cleanup.move();
    return new AuthService({
      auth,
      database,
      nodeHandler: toNodeHandler(auth),
      origin: options.origin,
    });
  }

  handle(request: Request) {
    return this.auth
      .handler(request)
      .catch(
        (cause) => new AuthServiceError({ detail: "handle request", cause }),
      );
  }

  handleHttp(request: IncomingMessage, response: ServerResponse) {
    return this.nodeHandler(request, response).catch(
      (cause) => new AuthServiceError({ detail: "handle request", cause }),
    );
  }

  async startDesktopSignIn(request: DesktopSignInRequest) {
    const signIn = parseDesktopSignInRequest(request);
    if (signIn instanceof Error) return signIn;

    const completion = new URL("/api/desktop-auth/complete", this.origin);
    completion.searchParams.set("callback", signIn.callback.toString());
    completion.searchParams.set("state", signIn.state);

    const result = await this.auth.api
      .signInSocial({
        body: {
          provider: "google",
          callbackURL: completion.toString(),
        },
      })
      .catch(
        (cause) =>
          new AuthServiceError({ detail: "start desktop sign-in", cause }),
      );
    if (result instanceof Error) return result;

    return result.url;
  }

  async completeDesktopSignIn(headers: Headers, request: DesktopSignInRequest) {
    const signIn = parseDesktopSignInRequest(request);
    if (signIn instanceof Error) return signIn;

    const code = await this.createDesktopAuthCode(headers);
    if (code instanceof Error) return code;

    signIn.callback.searchParams.set("code", code);
    signIn.callback.searchParams.set("state", signIn.state);
    return signIn.callback;
  }

  async exchangeDesktopAuthCode(code: string) {
    const result = await this.auth.api
      .verifyOneTimeToken({ body: { token: code } })
      .catch((cause: unknown) => {
        if (isAPIError(cause) && cause.statusCode === 400) {
          return new InvalidDesktopAuthCodeError();
        }
        return new AuthServiceError({
          detail: "exchange desktop auth code",
          cause,
        });
      });
    if (result instanceof Error) return result;

    return {
      token: result.session.token,
      session: {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: result.session.expiresAt,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image === null ? undefined : result.user.image,
      },
    } satisfies DesktopAuthSession;
  }

  async getSession(headers: Headers) {
    const result = await this.auth.api
      .getSession({ headers })
      .catch((cause) => new AuthServiceError({ detail: "get session", cause }));
    if (result instanceof Error) return result;
    if (result === null) return undefined;

    return {
      session: {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: result.session.expiresAt,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image === null ? undefined : result.user.image,
      },
    } satisfies AuthSession;
  }

  close() {
    return closeDatabase(this.database);
  }

  private async createDesktopAuthCode(headers: Headers) {
    const session = await this.getSession(headers);

    if (session instanceof Error) return session;
    if (session === undefined) return new DesktopAuthRequiredError();

    return this.auth.api
      .generateOneTimeToken({ headers })
      .then((result) => result.token)
      .catch(
        (cause) =>
          new AuthServiceError({ detail: "create desktop auth code", cause }),
      );
  }
}

function parseDesktopSignInRequest(request: DesktopSignInRequest) {
  if (!desktopAuthStatePattern.test(request.state)) {
    return new InvalidDesktopSignInRequestError();
  }

  const callback = errore.try({
    try: () => new URL(request.callback),
    catch: (cause) => new InvalidDesktopSignInRequestError({ cause }),
  });

  if (callback instanceof Error) return callback;

  if (callback.protocol !== "http:") {
    return new InvalidDesktopSignInRequestError();
  }

  if (callback.hostname !== loopbackHost) {
    return new InvalidDesktopSignInRequestError();
  }

  if (callback.port === "") return new InvalidDesktopSignInRequestError();

  if (callback.username !== "" || callback.password !== "") {
    return new InvalidDesktopSignInRequestError();
  }

  if (callback.search !== "" || callback.hash !== "") {
    return new InvalidDesktopSignInRequestError();
  }

  return { callback, state: request.state };
}

async function openDatabase(config: AuthDatabaseConfig) {
  if (config.type === "postgres") {
    return errore.try({
      try: () =>
        new Pool({ connectionString: config.connectionString, max: 5 }),
      catch: (cause) =>
        new AuthServiceError({ detail: "open PostgreSQL pool", cause }),
    });
  }

  const created = await fs
    .mkdir(dirname(config.path), { recursive: true, mode: 0o700 })
    .catch(
      (cause) =>
        new AuthServiceError({ detail: "create data directory", cause }),
    );
  if (created instanceof Error) return created;

  return errore.try({
    try: () => new DatabaseSync(config.path),
    catch: (cause) => new AuthServiceError({ detail: "open database", cause }),
  });
}

function closeDatabase(database: AuthDatabase) {
  if (database instanceof DatabaseSync) {
    return Promise.resolve(
      errore.try({
        try: () => database.close(),
        catch: (cause) =>
          new AuthServiceError({ detail: "close database", cause }),
      }),
    );
  }

  return database
    .end()
    .then(() => undefined)
    .catch(
      (cause) =>
        new AuthServiceError({ detail: "close PostgreSQL pool", cause }),
    );
}
