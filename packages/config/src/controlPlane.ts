import fs from "node:fs/promises";
import path from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import { ApplicationMode } from "./ApplicationMode.js";
import { readGcpSecret } from "./readGcpSecret.js";

const developmentPort = 8787;
const secretProjectId = "halo-relay";
const developmentAuthSecretIds = {
  secret: "halo-dev-local-better-auth-secret",
  googleClientId: "halo-dev-control-plane-google-client-id",
  googleClientSecret: "halo-dev-control-plane-google-client-secret",
};

const authSchema = Type.Object({
  secret: Type.String({ minLength: 32 }),
  googleClientId: Type.String({ minLength: 1 }),
  googleClientSecret: Type.String({ minLength: 1 }),
});
const portSchema = Type.Integer({ minimum: 0, maximum: 65_535 });

export const controlPlaneConfigSchema = Type.Union([
  Type.Object({
    deployment: Type.Literal("local"),
    appDataDir: Type.String(),
    port: portSchema,
    auth: authSchema,
  }),
  Type.Object({
    deployment: Type.Literal("cloudRun"),
    port: portSchema,
    origin: Type.String({ pattern: "^https://" }),
    databaseUrl: Type.String({ minLength: 1 }),
    auth: authSchema,
  }),
]);

export type ControlPlaneConfig = Static<typeof controlPlaneConfigSchema>;

export type ControlPlaneApplicationConfig = {
  mode: ApplicationMode;
  server: ControlPlaneConfig;
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

class ControlPlaneConfigError extends errore.createTaggedError({
  name: "ControlPlaneConfigError",
  message: "Control plane configuration failed: $detail",
}) {}

async function readConfig(): Promise<ControlPlaneApplicationConfig | Error> {
  const configPath = process.argv[2];
  if (configPath !== undefined) {
    const server = await readConfigFile(configPath);
    if (server instanceof Error) return server;
    return { mode: ApplicationMode.Production, server };
  }
  if (process.env.K_SERVICE === undefined) {
    const server = await readDevelopmentConfig();
    if (server instanceof Error) return server;
    return { mode: ApplicationMode.Development, server };
  }
  const server = await readCloudRunConfig();
  if (server instanceof Error) return server;
  return { mode: ApplicationMode.Production, server };
}

async function readConfigFile(configPath: string) {
  const raw = await fs.readFile(configPath, "utf8").catch(
    (cause) =>
      new ControlPlaneConfigError({
        detail: "read configuration file",
        cause,
      }),
  );
  if (raw instanceof Error) return raw;
  return parseConfig(raw, "configuration file");
}

function parseConfig(raw: string, source: string): ControlPlaneConfig | Error {
  const parsed = errore.try({
    // SAFETY: JSON.parse is untyped; controlPlaneConfigSchema validates the result below.
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new ControlPlaneConfigError({ detail: `parse ${source}`, cause }),
  });
  if (parsed instanceof Error) return parsed;
  if (!Value.Check(controlPlaneConfigSchema, parsed))
    return new ControlPlaneConfigError({ detail: `validate ${source}` });
  return parsed;
}

async function readAuthConfiguration(
  secretIds: AuthSecretIds,
): Promise<AuthConfiguration | Error> {
  const [secret, googleClientId, googleClientSecret] = await Promise.all([
    readGcpSecret({ projectId: secretProjectId, secretId: secretIds.secret }),
    readGcpSecret({
      projectId: secretProjectId,
      secretId: secretIds.googleClientId,
    }),
    readGcpSecret({
      projectId: secretProjectId,
      secretId: secretIds.googleClientSecret,
    }),
  ]);
  if (secret instanceof Error) return secret;
  if (googleClientId instanceof Error) return googleClientId;
  if (googleClientSecret instanceof Error) return googleClientSecret;
  return { secret, googleClientId, googleClientSecret };
}

async function readDevelopmentConfig(): Promise<ControlPlaneConfig | Error> {
  const auth = await readAuthConfiguration(developmentAuthSecretIds);
  if (auth instanceof Error) return auth;
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const configuredDataDir = process.env.HALO_USER_DATA;
  const server = {
    deployment: "local" as const,
    appDataDir:
      configuredDataDir === undefined
        ? path.join(repositoryRoot, ".halo")
        : path.resolve(configuredDataDir),
    port: developmentPort,
    auth,
  };
  if (!Value.Check(controlPlaneConfigSchema, server))
    return new ControlPlaneConfigError({
      detail: "validate development configuration",
    });
  return server;
}

async function readCloudRunConfig(): Promise<ControlPlaneConfig | Error> {
  const portValue = process.env.PORT;
  if (portValue === undefined)
    return new ControlPlaneConfigError({ detail: "set PORT" });
  const origin = process.env.BETTER_AUTH_URL;
  if (origin === undefined)
    return new ControlPlaneConfigError({ detail: "set BETTER_AUTH_URL" });
  const databaseUrlSecretId = process.env.DATABASE_URL_SECRET_ID;
  if (databaseUrlSecretId === undefined)
    return new ControlPlaneConfigError({
      detail: "set DATABASE_URL_SECRET_ID",
    });
  const authSecretId = process.env.BETTER_AUTH_SECRET_ID;
  if (authSecretId === undefined)
    return new ControlPlaneConfigError({
      detail: "set BETTER_AUTH_SECRET_ID",
    });
  const googleClientIdSecretId = process.env.GOOGLE_CLIENT_ID_SECRET_ID;
  if (googleClientIdSecretId === undefined)
    return new ControlPlaneConfigError({
      detail: "set GOOGLE_CLIENT_ID_SECRET_ID",
    });
  const googleClientSecretId = process.env.GOOGLE_CLIENT_SECRET_ID;
  if (googleClientSecretId === undefined)
    return new ControlPlaneConfigError({
      detail: "set GOOGLE_CLIENT_SECRET_ID",
    });

  const databaseUrl = await readGcpSecret({
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
  const server = {
    deployment: "cloudRun" as const,
    port: Number(portValue),
    origin,
    databaseUrl,
    auth,
  };
  if (!Value.Check(controlPlaneConfigSchema, server))
    return new ControlPlaneConfigError({
      detail: "validate Cloud Run configuration",
    });
  return server;
}

export const config = await readConfig();
