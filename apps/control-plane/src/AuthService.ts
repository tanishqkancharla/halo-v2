import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { toNodeHandler } from "better-auth/node";
import * as errore from "errore";
import { Pool } from "pg";

class AuthServiceError extends errore.createTaggedError({
  name: "AuthServiceError",
  message: "Auth service failed: $detail",
}) {}

type AuthServiceOptions = {
  database:
    | { type: "sqlite"; path: string }
    | { type: "postgres"; connectionString: string };
  origin: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  image: string | undefined;
};

type AuthSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: AuthUser;
};

type AuthDatabase = DatabaseSync | Pool;
type NodeHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

function authOptions(
  options: AuthServiceOptions,
  database: AuthDatabase,
): BetterAuthOptions {
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
  };
}

export class AuthService {
  private readonly auth: Auth;
  private readonly database: AuthDatabase;
  private readonly nodeHandler: NodeHandler;

  private constructor(ctx: {
    auth: Auth;
    database: AuthDatabase;
    nodeHandler: NodeHandler;
  }) {
    this.auth = ctx.auth;
    this.database = ctx.database;
    this.nodeHandler = ctx.nodeHandler;
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
}

async function openDatabase(config: AuthServiceOptions["database"]) {
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
