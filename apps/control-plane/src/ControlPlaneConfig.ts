import { Type, type Static } from "@sinclair/typebox";

export const controlPlaneConfigSchema = Type.Object({
  appDataDir: Type.String(),
  port: Type.Integer({ minimum: 0, maximum: 65535 }),
  auth: Type.Object({
    secret: Type.String({ minLength: 32 }),
    googleClientId: Type.String({ minLength: 1 }),
    googleClientSecret: Type.String({ minLength: 1 }),
  }),
});

export type ControlPlaneConfig = Static<typeof controlPlaneConfigSchema>;
