import { app, autoUpdater, dialog, type BrowserWindow } from "electron";
import * as errore from "errore";
import { updateElectronApp } from "update-electron-app";
import { UPDATE_CHANNELS } from "../shared/channels.js";
import type { AppInfo, AppUpdateStatus } from "../shared/rpc.js";

/** How often packaged macOS/Windows builds poll update.electronjs.org. */
export const UPDATE_POLL_INTERVAL = "10 minutes";

class UpdateNotReadyError extends errore.createTaggedError({
  name: "UpdateNotReadyError",
  message: "No downloaded update to install",
}) {}

let updateStatus: AppUpdateStatus = {
  state: "disabled",
  reason: "Updates start after launch",
};
let updatesEnabled = false;
let manualCheckPending = false;
let getWindow: () => BrowserWindow | undefined = () => undefined;

export function getAppInfo(): AppInfo {
  return {
    version: app.getVersion(),
    update: updateStatus,
  };
}

export function startAppUpdates(args: {
  isDevelopment: boolean;
  getWindow: () => BrowserWindow | undefined;
}): void {
  getWindow = args.getWindow;
  if (args.isDevelopment) {
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
    onNotifyUser: promptRendererToInstall,
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
    promptRendererToInstall();
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

export function installAppUpdate() {
  if (updateStatus.state !== "downloaded") return new UpdateNotReadyError();
  autoUpdater.quitAndInstall();
}

function promptRendererToInstall(): void {
  const window = getWindow();
  if (window === undefined) return;
  window.webContents.send(UPDATE_CHANNELS.prompt);
}
