import { app, autoUpdater } from "electron";
import { updateElectronApp } from "update-electron-app";
import type { AppInfo, AppUpdateStatus } from "../shared/rpc.js";

let updateStatus: AppUpdateStatus = {
  state: "disabled",
  reason: "Updates start after launch",
};

export function getAppInfo(): AppInfo {
  return {
    version: app.getVersion(),
    update: updateStatus,
  };
}

export function startAppUpdates(isDevelopment: boolean): void {
  if (isDevelopment) {
    updateStatus = {
      state: "disabled",
      reason: "Dev builds do not auto-update",
    };
    return;
  }
  if (process.platform === "linux") {
    updateStatus = {
      state: "disabled",
      reason: "Linux installs update manually from GitHub Releases",
    };
    return;
  }

  updateStatus = { state: "idle" };

  autoUpdater.on("checking-for-update", () => {
    updateStatus = { state: "checking" };
  });
  autoUpdater.on("update-available", () => {
    updateStatus = {
      state: "available",
      version: "newer",
    };
  });
  autoUpdater.on("update-downloaded", (_event, _notes, releaseName) => {
    updateStatus = {
      state: "downloaded",
      version: releaseName,
    };
  });
  autoUpdater.on("update-not-available", () => {
    updateStatus = { state: "idle" };
  });
  autoUpdater.on("error", (error) => {
    updateStatus = {
      state: "error",
      message: error.message,
    };
  });

  updateElectronApp();
}
