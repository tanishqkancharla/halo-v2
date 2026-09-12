import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type IpcMainEvent,
} from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Logger,
  type LogLevel,
  type LoggerData,
  type LoggerScope,
} from "@repo/logger";
import { config as resolvedApplicationConfig } from "@get-halo/config/electron";
import type { ControlPlaneSession } from "@get-halo/control-plane-contract";
import { JsonlLoggerSink } from "@repo/logger/JsonlLoggerSink";
import { PrettyConsoleLoggerSink } from "@repo/logger/PrettyConsoleLoggerSink";
import started from "electron-squirrel-startup";
import { LOG_CHANNELS } from "../shared/channels.js";
import { readWorkspaceServerConnection } from "@get-halo/workspace-server/connection";
import { checkForUpdates, startAppUpdates } from "./app/AppUpdate.js";
import {
  ControlPlaneAuth,
  type DesktopAuthentication,
} from "./ControlPlaneAuth.js";
import { registerDesktopApi } from "./DesktopApi.js";
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const currentDirectory = dirname(fileURLToPath(import.meta.url));

if (started) app.quit();

if (resolvedApplicationConfig instanceof Error)
  throw new Error("Electron could not read its application configuration", {
    cause: resolvedApplicationConfig,
  });
const applicationConfig = resolvedApplicationConfig;

if (applicationConfig.protectClosedStdio) {
  // Forge closes this process's stdio when it restarts main. A log after
  // that writes EPIPE; Node throws unless the stream has an error listener.
  ignoreClosedStdioPipe(process.stdout);
  ignoreClosedStdioPipe(process.stderr);
}
const fileSink = new JsonlLoggerSink({
  filePath: applicationConfig.logFilePath,
});
const logger = new Logger({
  sinks: applicationConfig.prettyConsoleLogging
    ? [new PrettyConsoleLoggerSink(), fileSink]
    : [fileSink],
});
const rendererLogger = logger.scope("renderer");

if (applicationConfig.remoteDebugging) {
  app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
  app.commandLine.appendSwitch("remote-debugging-port", "4445");
}
if (applicationConfig.useSwiftShader) {
  // Software WebGL for headless / Xvfb hosts where Mesa llvmpipe is blocklisted.
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-webgl");
  app.commandLine.appendSwitch("use-gl", "angle");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

let mainWindow: BrowserWindow | undefined;
const windows = new Set<BrowserWindow>();

// oxlint-disable-next-line typescript/no-floating-promises -- Electron owns the app-ready lifecycle and keeps the process alive for this work.
app.whenReady().then(async () => {
  const authentication = await createDesktopAuthentication();

  registerLogBridge();
  registerDesktopApi({
    authentication,
    getServer: async () =>
      await readWorkspaceServerConnection(applicationConfig.dataDir),
    ownsWindow: (window) => windows.has(window),
  });
  installMenu();
  await openMainWindow();
  if (applicationConfig.testWindowEvents) {
    const testEvents: NodeJS.EventEmitter = app;
    testEvents.on("halo:e2e:open-window", () => {
      // oxlint-disable-next-line typescript/no-floating-promises -- The harness waits for Electron's window event.
      void createWindow();
    });
  }
  startAppUpdates({
    config: applicationConfig.updates,
    getWindow: () => mainWindow,
  });
  logger.info({ event: "app-ready" });

  app.on("activate", () => {
    if (mainWindow !== undefined) return;
    // oxlint-disable-next-line typescript/no-floating-promises -- Electron activate callbacks cannot await window loading.
    void openMainWindow();
  });
});

async function createDesktopAuthentication(): Promise<DesktopAuthentication> {
  if (applicationConfig.testAuthentication) {
    const session = testAuthSession();

    return {
      getSession: async () => await Promise.resolve(session),
      signIn: async () => await Promise.resolve(session),
    };
  }

  const authentication = await ControlPlaneAuth.start({
    origin: applicationConfig.controlPlaneOrigin,
    dataDir: applicationConfig.dataDir,
  });
  return authentication;
}

function testAuthSession(): ControlPlaneSession {
  return {
    session: {
      id: "e2e-session",
      userId: "e2e-user",
      expiresAt: "2100-01-01T00:00:00.000Z",
    },
    user: {
      id: "e2e-user",
      email: "e2e@example.com",
      name: "E2E User",
    },
  };
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => logger.destroy());

async function openMainWindow(): Promise<void> {
  const window = await createWindow();
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
}

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    show: applicationConfig.showMainWindow,
    title: "Halo",
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    center: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 11, y: 11 },
    webPreferences: {
      preload: join(currentDirectory, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  windows.add(window);
  window.once("closed", () => windows.delete(window));

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(
      join(currentDirectory, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  return window;
}

function registerLogBridge(): void {
  ipcMain.on(
    LOG_CHANNELS.log,
    (
      event,
      payload: {
        level: LogLevel;
        scopes: readonly LoggerScope[];
        data: LoggerData;
      },
    ) => {
      assertTrustedSender(event);
      rendererLogger.write(payload, payload.scopes);
    },
  );
}

function assertTrustedSender(event: IpcMainEvent): BrowserWindow {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow === null || !windows.has(senderWindow)) {
    throw new Error("Halo rejected IPC from an unknown renderer.");
  }
  return senderWindow;
}

function installMenu(): void {
  const checkForUpdatesItem = {
    label: "Check for Updates…",
    click: () => checkForUpdates(),
  };
  const openLogsItem = {
    label: "Open Logs",
    click: () => {
      // oxlint-disable-next-line typescript/no-floating-promises -- Electron menu callbacks cannot await command work.
      void openLogs();
    },
  };
  const viewSubmenu = [
    {
      label: "Reload",
      accelerator: "CmdOrCtrl+R",
      click: () => mainWindow?.reload(),
    },
    { role: "toggleDevTools" as const },
  ];

  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            checkForUpdatesItem,
            openLogsItem,
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        { role: "editMenu" },
        { label: "View", submenu: viewSubmenu },
        { role: "windowMenu" },
      ]),
    );
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "editMenu" },
      { label: "View", submenu: viewSubmenu },
      { role: "windowMenu" },
      { label: "Help", submenu: [checkForUpdatesItem, openLogsItem] },
    ]),
  );
}

async function openLogs(): Promise<void> {
  const errorMessage = await shell.openPath(applicationConfig.logsDir);
  if (errorMessage === "") return;
  logger.error({ event: "open-logs-failed", error: errorMessage });
  if (mainWindow === undefined) return;
  await dialog.showMessageBox(mainWindow, {
    type: "error",
    title: "Open Logs",
    message: "Could not open the logs folder",
    detail: `${errorMessage}\n\n${applicationConfig.logsDir}`,
  });
}

function ignoreClosedStdioPipe(stream: NodeJS.WriteStream) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") return;
    throw error;
  });
}
