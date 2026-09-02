import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MessageChannelMain,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Logger,
  type LogLevel,
  type LoggerData,
  type LoggerScope,
} from "@get-halo/logger";
import { JsonlLoggerSink } from "@get-halo/logger/JsonlLoggerSink";
import { PrettyConsoleLoggerSink } from "@get-halo/logger/PrettyConsoleLoggerSink";
import { FilesystemService, HaloServer } from "@get-halo/server";
import * as errore from "errore";
import type { HaloContext } from "@get-halo/server/router";
import { resolveHaloCliEntry } from "@get-halo/server/workspace/installHaloCli";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/message-port";
import started from "electron-squirrel-startup";
import { LOG_CHANNELS, RPC_CHANNELS } from "../shared/channels.js";
import { DESKTOP_CHANNEL, type DesktopRequest } from "../shared/desktop.js";
import { getApplicationConfig, getLogFilePath } from "./ApplicationConfig.js";
import {
  checkForUpdates,
  getAppInfo,
  installAppUpdate,
  startAppUpdates,
} from "./app/AppUpdate.js";
import { ElectronServerHost } from "./ElectronServerHost.js";
import { listenHaloRpcHttp, type HaloRpcHttp } from "./HaloRpcHttp.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
const filesystemService = new FilesystemService();
let mainWindow: BrowserWindow | undefined;
let rpcHttp: HaloRpcHttp | undefined;
let shutdownStarted = false;

class DesktopBridgeError extends errore.createTaggedError({
  name: "DesktopBridgeError",
  message: "Desktop action failed during $operation",
}) {}

if (started) app.quit();

loadDevelopmentEnvironment(filesystemService);
configureUserDataPath();

const applicationConfig = getApplicationConfig({
  isDevelopment,
  filesystem: filesystemService,
});
if (isDevelopment) {
  // Forge closes this process's stdio when it restarts main. A log after
  // that writes EPIPE; Node throws unless the stream has an error listener.
  ignoreClosedStdioPipe(process.stdout);
  ignoreClosedStdioPipe(process.stderr);
}
const fileSink = new JsonlLoggerSink({
  filePath: getLogFilePath(applicationConfig),
});
const logger = new Logger({
  sinks: isDevelopment ? [new PrettyConsoleLoggerSink(), fileSink] : [fileSink],
});
const rendererLogger = logger.scope("renderer");
const rpcLogger = logger.scope("rpc");

if (isDevelopment) {
  app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
  app.commandLine.appendSwitch("remote-debugging-port", "4445");
}
if (process.env.HALO_USE_SWIFTSHADER === "1") {
  // Software WebGL for headless / Xvfb hosts where Mesa llvmpipe is blocklisted.
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-webgl");
  app.commandLine.appendSwitch("use-gl", "angle");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

process.env.HALO_USER_DATA = applicationConfig.dataDir;

const serverHost = new ElectronServerHost();
const haloServer = new HaloServer({
  appDataDir: applicationConfig.dataDir,
  filesystem: filesystemService,
  appVersion: app.getVersion(),
  cliEntry: resolveHaloCliEntry(filesystemService, import.meta.url),
  cliNodeExecutable: isDevelopment ? "node" : process.execPath,
  cliElectronRunAsNode: !isDevelopment,
  isDevelopment,
  host: serverHost,
  logger: rpcLogger,
});

// oxlint-disable-next-line typescript/no-floating-promises -- Electron owns the app-ready lifecycle and keeps the process alive for this work.
app.whenReady().then(async () => {
  await haloServer.start();
  registerLogBridge();
  registerRpcBridge();
  registerDesktopBridge();
  const listening = await listenHaloRpcHttp({
    context: haloServer.context,
    router: haloServer.router,
    filesystem: filesystemService,
    userDataDir: applicationConfig.dataDir,
  });
  if (listening instanceof Error) {
    logger.error({ event: "rpc-http-listen-failed", error: listening });
  } else {
    rpcHttp = listening;
    haloServer.setOAuthRedirectUri(listening.oauthRedirectUri);
  }
  installMenu();
  await openMainWindow();
  startAppUpdates({
    isDevelopment,
    getWindow: () => mainWindow,
  });
  logger.info({ event: "app-ready" });

  app.on("activate", () => {
    if (mainWindow !== undefined) return;
    // oxlint-disable-next-line typescript/no-floating-promises -- Electron activate callbacks cannot await window loading.
    void openMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", (event) => {
  if (shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  const pending = rpcHttp;
  rpcHttp = undefined;
  // oxlint-disable-next-line typescript/no-floating-promises -- Electron requires will-quit to return while cleanup runs before the second quit call.
  void closeAppServices(pending).finally(() => {
    logger.destroy();
    app.quit();
  });
});

async function closeAppServices(http: HaloRpcHttp | undefined) {
  await haloServer.close();
  if (http !== undefined) {
    await http.close().catch((error) => {
      logger.error({ event: "rpc-http-close-failed", error });
    });
  }
}

async function openMainWindow(): Promise<void> {
  const window = await createWindow();
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
}

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
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

function registerRpcBridge(): void {
  ipcMain.on(RPC_CHANNELS.requestRpc, (event) => {
    assertTrustedSender(event);
    const frame = event.senderFrame;
    if (frame === null) {
      throw new Error("Halo rejected RPC without a sender frame.");
    }
    const { port1, port2 } = new MessageChannelMain();
    const handler = new RPCHandler<HaloContext>(haloServer.router, {
      interceptors: [
        onError((error) => {
          if (error instanceof Error) {
            rpcLogger.warn({ event: "orpc", error });
            return;
          }
          rpcLogger.warn({ event: "orpc", error: String(error) });
        }),
      ],
    });
    handler.upgrade(port1, { context: haloServer.context });
    port1.start();
    // Electron's postMessage payload; the ports carry the RPC transport.
    // oxlint-disable-next-line unicorn/no-null
    frame.postMessage(RPC_CHANNELS.provideRpc, null, [port2]);
  });
}

function registerDesktopBridge(): void {
  ipcMain.handle(DESKTOP_CHANNEL, async (event, request: DesktopRequest) => {
    const window = assertTrustedSender(event);
    switch (request.method) {
      case "chooseWorkspace": {
        const workspace = await chooseWorkspace(window, {
          title: "Choose a Halo workspace",
          buttonLabel: "Choose workspace",
        });
        if (workspace instanceof Error) throw workspace;
        return workspace;
      }
      case "getAppInfo":
        return getAppInfo();
      case "installAppUpdate": {
        const installed = installAppUpdate();
        if (installed instanceof Error) throw installed;
        return;
      }
      case "openExternal": {
        const opened = await shell.openExternal(request.url).catch(
          (cause) =>
            new DesktopBridgeError({
              operation: "opening an external URL",
              cause,
            }),
        );
        if (opened instanceof Error) throw opened;
      }
    }
  });
}

function assertTrustedSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
): BrowserWindow {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow === null || senderWindow !== mainWindow) {
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
  const switchWorkspaceItem = {
    label: "Switch Workspace…",
    click: () => {
      // oxlint-disable-next-line typescript/no-floating-promises -- Electron menu callbacks cannot await command work.
      void switchWorkspace();
    },
  };
  const fileMenu = {
    label: "File",
    submenu: [
      switchWorkspaceItem,
      { type: "separator" as const },
      process.platform === "darwin"
        ? { role: "close" as const }
        : { role: "quit" as const },
    ],
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
        fileMenu,
        { role: "editMenu" },
        { label: "View", submenu: viewSubmenu },
        { role: "windowMenu" },
      ]),
    );
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      fileMenu,
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

async function switchWorkspace(): Promise<void> {
  if (mainWindow === undefined) return;

  const previous = haloServer.getWorkspace();
  const workspace = await chooseWorkspace(mainWindow, {
    title: "Switch workspace",
    buttonLabel: "Switch workspace",
  });
  if (workspace === undefined) return;
  if (workspace instanceof Error) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Switch Workspace",
      message: "Could not switch workspace",
      detail: workspace.message,
    });
    return;
  }
  if (
    previous !== undefined &&
    previous.workspaceRoot === workspace.workspaceRoot
  ) {
    return;
  }

  mainWindow.reload();
}

async function chooseWorkspace(
  window: BrowserWindow,
  labels: { title: string; buttonLabel: string },
) {
  const selection = await dialog
    .showOpenDialog(window, {
      ...labels,
      properties: ["openDirectory"],
    })
    .catch(
      (cause) =>
        new DesktopBridgeError({ operation: "workspace selection", cause }),
    );
  if (selection instanceof Error) return selection;
  if (selection.canceled) return undefined;
  const directory = selection.filePaths[0];
  if (directory === undefined) {
    return new DesktopBridgeError({
      operation: "workspace selection",
      cause: new Error("Electron returned no selected directory"),
    });
  }
  return await haloServer.selectWorkspace(directory);
}

function ignoreClosedStdioPipe(stream: NodeJS.WriteStream) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") return;
    throw error;
  });
}

function configureUserDataPath(): void {
  if (!isDevelopment) return;
  const appDirectory = join(currentDirectory, "../..");
  app.setPath("userData", join(appDirectory, "../..", ".halo"));
}

function loadDevelopmentEnvironment(filesystem: FilesystemService): void {
  if (!isDevelopment) return;
  const appDirectory = join(currentDirectory, "../..");
  const environmentFile = [
    join(appDirectory, ".env"),
    join(appDirectory, "../../.env"),
  ].find((path) => filesystem.exists(path));
  if (environmentFile === undefined) return;
  const loaded = filesystem.loadEnvironmentFile(environmentFile);
  if (loaded instanceof Error) throw loaded;
}
