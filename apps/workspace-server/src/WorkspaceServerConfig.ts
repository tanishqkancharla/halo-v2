import { Type, type Static } from "@sinclair/typebox";

export const workspaceServerConfigSchema = Type.Object({
  workspaceRoot: Type.String(),
  appDataDir: Type.String(),
  appVersion: Type.String(),
  ownerUserId: Type.String(),
  logFilePath: Type.String(),
  corsOrigins: Type.Array(Type.String()),
  port: Type.Integer({ minimum: 0, maximum: 65535 }),
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

export type WorkspaceServerConfig = Static<typeof workspaceServerConfigSchema>;

const connectionSchema = Type.Object({
  host: Type.String(),
  port: Type.Number(),
  token: Type.String(),
});

export const workspaceServerReadySchema = Type.Object({
  workspace: Type.Object({ name: Type.String(), workspaceRoot: Type.String() }),
  connections: Type.Object({
    cli: connectionSchema,
    renderer: connectionSchema,
  }),
});

export type WorkspaceServerReady = Static<typeof workspaceServerReadySchema>;
