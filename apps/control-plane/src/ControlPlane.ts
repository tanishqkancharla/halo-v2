import { join } from "node:path";
import {
  removeControlPlaneDiscovery,
  writeControlPlaneDiscovery,
} from "@get-halo/control-plane-contract/discovery";
import type { ControlPlaneConfig } from "@get-halo/config/controlPlane";
import * as errore from "errore";
import { AuthService, type AuthDatabaseConfig } from "./AuthService.js";
import {
  closeControlPlaneHttp,
  type ListeningControlPlaneHttp,
  listenControlPlaneHttp,
  serveControlPlaneHttp,
} from "./ControlPlaneHttp.js";

const loopbackHost = "127.0.0.1";
const cloudRunHost = "0.0.0.0";

export class ControlPlane {
  private readonly appDataDir: string | undefined;
  private readonly auth: AuthService;
  private readonly http: ListeningControlPlaneHttp;
  private readonly publicOrigin: string;

  private constructor(ctx: {
    appDataDir: string | undefined;
    auth: AuthService;
    http: ListeningControlPlaneHttp;
    publicOrigin: string;
  }) {
    this.appDataDir = ctx.appDataDir;
    this.auth = ctx.auth;
    this.http = ctx.http;
    this.publicOrigin = ctx.publicOrigin;
  }

  get origin() {
    return this.publicOrigin;
  }

  static async start(config: ControlPlaneConfig) {
    await using cleanup = new errore.AsyncDisposableStack();

    const http = await listenControlPlaneHttp(
      controlPlaneHost(config),
      config.port,
    );
    if (http instanceof Error) return http;

    cleanup.defer(async () => {
      const closed = await closeControlPlaneHttp(http.server);
      if (closed instanceof Error) console.error(closed);
    });

    const publicOrigin =
      config.deployment === "local" ? http.origin : config.origin;

    if (config.deployment === "local") {
      const published = await writeControlPlaneDiscovery({
        appDataDir: config.appDataDir,
        origin: publicOrigin,
      });
      if (published instanceof Error) return published;

      cleanup.defer(async () => {
        const removed = await removeControlPlaneDiscovery(config.appDataDir);
        if (removed instanceof Error) console.error(removed);
      });
    }

    const auth = await AuthService.start({
      database: authDatabase(config),
      origin: publicOrigin,
      secret: config.auth.secret,
      googleClientId: config.auth.googleClientId,
      googleClientSecret: config.auth.googleClientSecret,
    });
    if (auth instanceof Error) return auth;

    cleanup.defer(async () => {
      const closed = await auth.close();
      if (closed instanceof Error) console.error(closed);
    });

    serveControlPlaneHttp(http.server, auth);
    cleanup.move();

    return new ControlPlane({
      appDataDir: config.deployment === "local" ? config.appDataDir : undefined,
      auth,
      http,
      publicOrigin,
    });
  }

  async close() {
    const httpClosed = await closeControlPlaneHttp(this.http.server);
    const authClosed = await this.auth.close();
    const originFileRemoved =
      this.appDataDir === undefined
        ? undefined
        : await removeControlPlaneDiscovery(this.appDataDir);

    if (httpClosed instanceof Error) return httpClosed;
    if (authClosed instanceof Error) return authClosed;
    if (originFileRemoved instanceof Error) return originFileRemoved;
  }
}

function controlPlaneHost(config: ControlPlaneConfig) {
  return config.deployment === "local" ? loopbackHost : cloudRunHost;
}

function authDatabase(config: ControlPlaneConfig): AuthDatabaseConfig {
  if (config.deployment === "local") {
    return {
      type: "sqlite",
      path: join(config.appDataDir, "auth.db"),
    };
  }

  return {
    type: "postgres",
    connectionString: config.databaseUrl,
  };
}
