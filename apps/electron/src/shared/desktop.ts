import { type Static, Type } from "@sinclair/typebox";
import type { WorkspaceInfo } from "@get-halo/shared/rpc";

export type AppUpdateStatus =
  | { state: "disabled"; reason: string }
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

export type AppInfo = {
  version: string;
  update: AppUpdateStatus;
};

export const DESKTOP_CHANNEL = "halo:desktop";

export const desktopRequestSchema = Type.Union([
  Type.Object(
    { type: Type.Literal("chooseWorkspace") },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal("getAppInfo") },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal("installAppUpdate") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal("openExternal"),
      url: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

export type DesktopRequest = Static<typeof desktopRequestSchema>;
export type OpenExternalRequest = Extract<
  DesktopRequest,
  { type: "openExternal" }
>;

export type DesktopApi = {
  chooseWorkspace: () => Promise<WorkspaceInfo | undefined>;
  getAppInfo: () => Promise<AppInfo>;
  installAppUpdate: () => Promise<void>;
  openExternal: (request: OpenExternalRequest) => Promise<void>;
};

declare global {
  interface Window {
    haloDesktop: DesktopApi;
  }
}
