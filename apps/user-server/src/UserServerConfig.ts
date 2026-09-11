import { Type, type Static } from "@sinclair/typebox";

export const userServerConfigSchema = Type.Object({
  workspaceRoot: Type.String(),
  appDataDir: Type.String(),
  appVersion: Type.String(),
  ownerUserId: Type.String(),
  logFilePath: Type.String(),
  corsOrigins: Type.Array(Type.String()),
  cliEntry: Type.Optional(Type.String()),
  cliNodeExecutable: Type.Optional(Type.String()),
  cliElectronRunAsNode: Type.Optional(Type.Boolean()),
  extensionRuntime: Type.Optional(
    Type.Object({
      executable: Type.String(),
      electronRunAsNode: Type.Boolean(),
    }),
  ),
  appBrowserTarget: Type.Optional(
    Type.Object({
      cdpUrl: Type.String(),
      pageUrl: Type.String(),
    }),
  ),
  testingApiEnabled: Type.Optional(Type.Boolean()),
});

export type UserServerConfig = Static<typeof userServerConfigSchema>;

const connectionSchema = Type.Object({
  host: Type.String(),
  port: Type.Number(),
  token: Type.String(),
});

export const userServerReadySchema = Type.Object({
  workspace: Type.Object({ name: Type.String(), workspaceRoot: Type.String() }),
  connections: Type.Object({
    cli: connectionSchema,
    renderer: connectionSchema,
  }),
});

export type UserServerReady = Static<typeof userServerReadySchema>;
