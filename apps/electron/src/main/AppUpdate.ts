import { app, autoUpdater, dialog } from "electron";
import { updateElectronApp } from "update-electron-app";
import type { AppInfo, AppUpdateStatus } from "../shared/rpc.js";

/** How often packaged macOS/Windows builds poll update.electronjs.org. */
export const UPDATE_POLL_INTERVAL = "10 minutes";

let updateStatus: AppUpdateStatus = {
  state: "disabled",
  reason: "Updates start after launch",
};
let updatesEnabled = false;
let manualCheckPending = false;

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

  updatesEnabled = true;
  updateStatus = { state: "idle" };

  autoUpdater.on("checking-for-update", () => {
    updateStatus = { state: "checking" };
  });
  autoUpdater.on("update-available", () => {
    manualCheckPending = false;
    updateStatus = { state: "available" };
  });
  autoUpdater.on("update-downloaded", (_event, _notes, releaseName) => {
    manualCheckPending = false;
    updateStatus = {
      state: "downloaded",
      version: releaseName,
    };
  });
  autoUpdater.on("update-not-available", () => {
    updateStatus = { state: "idle" };
    if (!manualCheckPending) return;
    manualCheckPending = false;
    void dialog.showMessageBox({
      type: "info",
      title: "Check for Updates",
      message: "Halo is up to date",
      detail: `Version ${app.getVersion()}`,
    });
  });
  autoUpdater.on("error", (error) => {
    updateStatus = {
      state: "error",
      message: error.message,
    };
    if (!manualCheckPending) return;
    manualCheckPending = false;
    void dialog.showMessageBox({
      type: "error",
      title: "Check for Updates",
      message: "Could not check for updates",
      detail: error.message,
    });
  });

  updateElectronApp({
    updateInterval: UPDATE_POLL_INTERVAL,
  });
}

export function checkForUpdates(): void {
  if (!updatesEnabled) {
    const detail =
      updateStatus.state === "disabled"
        ? updateStatus.reason
        : "Updates are not available.";
    void dialog.showMessageBox({
      type: "info",
      title: "Check for Updates",
      message: "Updates are not available",
      detail,
    });
    return;
  }

  if (updateStatus.state === "downloaded") {
    void dialog
      .showMessageBox({
        type: "info",
        title: "Check for Updates",
        message: `Update ${updateStatus.version} is ready`,
        detail: "Restart Halo to install it.",
        buttons: ["Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    return;
  }

  if (updateStatus.state === "available" || updateStatus.state === "checking") {
    void dialog.showMessageBox({
      type: "info",
      title: "Check for Updates",
      message:
        updateStatus.state === "checking"
          ? "Checking for updates…"
          : "Downloading update…",
    });
    return;
  }

  manualCheckPending = true;
  updateStatus = { state: "checking" };
  autoUpdater.checkForUpdates();
}
