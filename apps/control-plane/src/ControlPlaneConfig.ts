import { Type, type Static } from "@sinclair/typebox";

export const controlPlaneConfigSchema = Type.Object({
  appDataDir: Type.String(),
  port: Type.Integer({ minimum: 0, maximum: 65535 }),
});

export type ControlPlaneConfig = Static<typeof controlPlaneConfigSchema>;
