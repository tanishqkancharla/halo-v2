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

export type DesktopApi = {
  chooseWorkspace: () => Promise<WorkspaceInfo | undefined>;
  getAppInfo: () => Promise<AppInfo>;
  installAppUpdate: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
};

export type DesktopRequest =
  | { method: "chooseWorkspace" }
  | { method: "getAppInfo" }
  | { method: "installAppUpdate" }
  | { method: "openExternal"; url: string };

export type DesktopResponse<T extends DesktopRequest> =
  T["method"] extends "chooseWorkspace"
    ? WorkspaceInfo | undefined
    : T["method"] extends "getAppInfo"
      ? AppInfo
      : undefined;

export const DESKTOP_CHANNEL = "halo:desktop";
