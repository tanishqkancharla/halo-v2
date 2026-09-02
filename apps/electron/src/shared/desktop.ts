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

export const DESKTOP_CHANNELS = {
  chooseWorkspace: "halo:desktop:choose-workspace",
  getAppInfo: "halo:desktop:get-app-info",
  installAppUpdate: "halo:desktop:install-app-update",
  openExternal: "halo:desktop:open-external",
} as const;

export const emptyDesktopRequestSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const openExternalRequestSchema = Type.Object(
  {
    url: Type.String(),
  },
  { additionalProperties: false },
);

export type EmptyDesktopRequest = Static<typeof emptyDesktopRequestSchema>;
export type OpenExternalRequest = Static<typeof openExternalRequestSchema>;

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
