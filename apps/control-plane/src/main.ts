import fsPromises from "node:fs/promises";
import { join, resolve } from "node:path";
import { readSecret } from "@get-halo/gcp/secrets";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import { ControlPlane } from "./ControlPlane.js";
import {
  controlPlaneConfigSchema,
  type ControlPlaneConfig,
} from "./ControlPlaneConfig.js";

const developmentPort = 8787;
const secretProjectId = "halo-relay";
const developmentAuthSecretIds = {
  secret: "halo-dev-local-better-auth-secret",
  googleClientId: "halo-dev-control-plane-google-client-id",
  googleClientSecret: "halo-dev-control-plane-google-client-secret",
};

interface AuthSecretIds {
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
}

interface AuthConfiguration {
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
}

class ControlPlaneStartupError extends errore.createTaggedError({
  name: "ControlPlaneStartupError",
  message: "Control plane startup failed: $detail",
}) {}

async function readConfiguration(): Promise<ControlPlaneConfig | Error> {
  const configPath = process.argv[2];
  if (configPath === undefined) {
    return process.env.K_SERVICE === undefined
      ? await developmentConfiguration()
      : await cloudRunConfiguration();
  }
  const raw = await fsPromises
    .readFile(configPath, "utf8")
    .catch(
      (cause) =>
        new ControlPlaneStartupError({ detail: "read configuration", cause }),
    );
  if (raw instanceof Error) return raw;
  const config = errore.try({
    // SAFETY: JSON.parse is untyped; controlPlaneConfigSchema validates the result below.
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new ControlPlaneStartupError({ detail: "parse configuration", cause }),
  });
  if (config instanceof Error) return config;
  if (!Value.Check(controlPlaneConfigSchema, config))
    return new ControlPlaneStartupError({ detail: "invalid configuration" });
  return config;
}

async function readAuthConfiguration(
  secretIds: AuthSecretIds,
): Promise<AuthConfiguration | Error> {
  const [secret, googleClientId, googleClientSecret] = await Promise.all([
    readSecret({ projectId: secretProjectId, secretId: secretIds.secret }),
    readSecret({
      projectId: secretProjectId,
      secretId: secretIds.googleClientId,
    }),
    readSecret({
      projectId: secretProjectId,
      secretId: secretIds.googleClientSecret,
    }),
  ]);
  if (secret instanceof Error) return secret;
  if (googleClientId instanceof Error) return googleClientId;
  if (googleClientSecret instanceof Error) return googleClientSecret;
  return { secret, googleClientId, googleClientSecret };
}

async function developmentConfiguration(): Promise<ControlPlaneConfig | Error> {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");
  const auth = await readAuthConfiguration(developmentAuthSecretIds);
  if (auth instanceof Error) return auth;
  const appDataDir =
    process.env.HALO_USER_DATA === undefined
      ? join(repositoryRoot, ".halo")
      : resolve(process.env.HALO_USER_DATA);
  const config = {
    deployment: "local" as const,
    appDataDir,
    port: developmentPort,
    auth,
  };
  if (!Value.Check(controlPlaneConfigSchema, config))
    return new ControlPlaneStartupError({
      detail: "invalid development configuration",
    });
  return config;
}

async function cloudRunConfiguration(): Promise<ControlPlaneConfig | Error> {
  const portValue = process.env.PORT;
  if (portValue === undefined)
    return new ControlPlaneStartupError({ detail: "set PORT" });
  const port = Number(portValue);
  const origin = process.env.BETTER_AUTH_URL;
  if (origin === undefined)
    return new ControlPlaneStartupError({ detail: "set BETTER_AUTH_URL" });
  const databaseUrlSecretId = process.env.DATABASE_URL_SECRET_ID;
  if (databaseUrlSecretId === undefined)
    return new ControlPlaneStartupError({
      detail: "set DATABASE_URL_SECRET_ID",
    });
  const authSecretId = process.env.BETTER_AUTH_SECRET_ID;
  if (authSecretId === undefined)
    return new ControlPlaneStartupError({
      detail: "set BETTER_AUTH_SECRET_ID",
    });
  const googleClientIdSecretId = process.env.GOOGLE_CLIENT_ID_SECRET_ID;
  if (googleClientIdSecretId === undefined)
    return new ControlPlaneStartupError({
      detail: "set GOOGLE_CLIENT_ID_SECRET_ID",
    });
  const googleClientSecretId = process.env.GOOGLE_CLIENT_SECRET_ID;
  if (googleClientSecretId === undefined)
    return new ControlPlaneStartupError({
      detail: "set GOOGLE_CLIENT_SECRET_ID",
    });
  const databaseUrl = await readSecret({
    projectId: secretProjectId,
    secretId: databaseUrlSecretId,
  });
  if (databaseUrl instanceof Error) return databaseUrl;
  const auth = await readAuthConfiguration({
    secret: authSecretId,
    googleClientId: googleClientIdSecretId,
    googleClientSecret: googleClientSecretId,
  });
  if (auth instanceof Error) return auth;
  const config = {
    deployment: "cloudRun" as const,
    port,
    origin,
    databaseUrl,
    auth,
  };
  if (!Value.Check(controlPlaneConfigSchema, config))
    return new ControlPlaneStartupError({
      detail: "invalid Cloud Run configuration",
    });
  return config;
}

async function run() {
  const stopping = new Promise<void>((stop) => {
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    process.once("disconnect", stop);
    process.on("message", (message) => {
      if (message === "shutdown") stop();
    });
  });
  const config = await readConfiguration();
  if (config instanceof Error) return config;
  const plane = await ControlPlane.start(config);
  if (plane instanceof Error) return plane;
  await using cleanup = new errore.AsyncDisposableStack();
  cleanup.defer(async () => {
    const closed = await plane.close();
    if (closed instanceof Error) console.error(closed);
  });
  console.log(`Control plane listening at ${plane.origin}`);
  if (process.connected) process.send?.({ origin: plane.origin });
  await stopping;
}

// oxlint-disable-next-line typescript/no-floating-promises -- This entry point owns the process lifetime and exits after service cleanup.
run().then((result) => {
  if (result instanceof Error) console.error(result);
  process.exit(result instanceof Error ? 1 : 0);
});
