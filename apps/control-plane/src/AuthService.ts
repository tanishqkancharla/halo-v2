import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { toNodeHandler } from "better-auth/node";
import * as errore from "errore";

class AuthServiceError extends errore.createTaggedError({
  name: "AuthServiceError",
  message: "Auth service failed: $detail",
}) {}

type AuthServiceOptions = {
  appDataDir: string;
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

function createAuth(options: AuthServiceOptions, database: DatabaseSync) {
  return betterAuth({
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
  });
}

export class AuthService {
  private constructor(
    private readonly resources: {
      auth: ReturnType<typeof createAuth>;
      database: DatabaseSync;
      nodeHandler: ReturnType<typeof toNodeHandler>;
    },
  ) {}

  static async start(options: AuthServiceOptions) {
    await using cleanup = new errore.AsyncDisposableStack();
    const created = await fs
      .mkdir(options.appDataDir, { recursive: true, mode: 0o700 })
      .catch(
        (cause) =>
          new AuthServiceError({ detail: "create data directory", cause }),
      );
    if (created instanceof Error) return created;

    const database = errore.try({
      try: () => new DatabaseSync(join(options.appDataDir, "auth.db")),
      catch: (cause) =>
        new AuthServiceError({ detail: "open database", cause }),
    });
    if (database instanceof Error) return database;
    cleanup.defer(() => database.close());

    const auth = createAuth(options, database);
    const migrations = await getMigrations(auth.options).catch(
      (cause) => new AuthServiceError({ detail: "prepare migrations", cause }),
    );
    if (migrations instanceof Error) return migrations;
    const migrated = await migrations
      .runMigrations()
      .catch(
        (cause) => new AuthServiceError({ detail: "run migrations", cause }),
      );
    if (migrated instanceof Error) return migrated;

    cleanup.move();
    return new AuthService({
      auth,
      database,
      nodeHandler: toNodeHandler(auth),
    });
  }

  handle(request: Request) {
    return this.resources.auth
      .handler(request)
      .catch(
        (cause) => new AuthServiceError({ detail: "handle request", cause }),
      );
  }

  handleHttp(request: IncomingMessage, response: ServerResponse) {
    return this.resources
      .nodeHandler(request, response)
      .catch(
        (cause) => new AuthServiceError({ detail: "handle request", cause }),
      );
  }

  async getSession(headers: Headers) {
    const result = await this.resources.auth.api
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
    return errore.try({
      try: () => this.resources.database.close(),
      catch: (cause) =>
        new AuthServiceError({ detail: "close database", cause }),
    });
  }
}
