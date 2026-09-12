import { Type, type Static } from "@sinclair/typebox";

const authSchema = Type.Object({
  secret: Type.String({ minLength: 32 }),
  googleClientId: Type.String({ minLength: 1 }),
  googleClientSecret: Type.String({ minLength: 1 }),
});

const portSchema = Type.Integer({ minimum: 0, maximum: 65535 });

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
