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
import { JsonlLoggerSink } from "@repo/logger/JsonlLoggerSink";
import { PrettyConsoleLoggerSink } from "@repo/logger/PrettyConsoleLoggerSink";
import started from "electron-squirrel-startup";
import { LOG_CHANNELS } from "../shared/channels.js";
import type { HaloRpcConnection } from "../shared/rpc.js";
import { HaloServer } from "@get-halo/server";
import { resolveHaloCliEntry } from "@get-halo/server/cli";
import { FilesystemService } from "@get-halo/server/filesystem";
import { getApplicationConfig, getLogFilePath } from "./ApplicationConfig.js";
import { checkForUpdates, startAppUpdates } from "./app/AppUpdate.js";
import { registerDesktopApi } from "./DesktopApi.js";
import { createEncryptedFileCredentialVault } from "./EncryptedFileCredentialVault.js";
import { removeHaloRpcFile, writeHaloRpcFile } from "./rpcFile.js";
import { UserService } from "./UserService.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
const filesystemService = new FilesystemService();

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

const userService = new UserService({
  appDataDir: applicationConfig.dataDir,
  filesystem: filesystemService,
});
const ownerUserId = userService
  .getUser()
  .then((user) => (user instanceof Error ? user : user.id));
const haloServer = new HaloServer({
  appDataDir: applicationConfig.dataDir,
  appVersion: app.getVersion(),
  cliEntry: resolveHaloCliEntry(filesystemService, import.meta.url),
  cliNodeExecutable: isDevelopment ? "node" : process.execPath,
  cliElectronRunAsNode: !isDevelopment,
  isDevelopment,
  ownerUserId,
  logger: rpcLogger,
  createCredentialVault: ({ filesystem, workspaceRoot }) =>
    createEncryptedFileCredentialVault({
      filesystem,
      workspaceRoot,
    }),
});
let mainWindow: BrowserWindow | undefined;
let rpcConnection: HaloRpcConnection | undefined;
let shutdownStarted = false;

// oxlint-disable-next-line typescript/no-floating-promises -- Electron owns the app-ready lifecycle and keeps the process alive for this work.
app.whenReady().then(async () => {
  registerLogBridge();
  registerDesktopApi({
    selectWorkspace: (directory) => haloServer.selectWorkspace(directory),
    getWindow: () => mainWindow,
  });
  const listening = await haloServer.listen({
    host: "127.0.0.1",
    port: 0,
    corsOrigins: [getRendererOrigin()],
  });
  if (listening instanceof Error) {
    logger.error({ event: "rpc-http-listen-failed", error: listening });
    app.quit();
    return;
  }
  const rpcFile = await writeHaloRpcFile({
    userDataDir: applicationConfig.dataDir,
    connection: listening.cli,
  });
  if (rpcFile instanceof Error) {
    logger.error({ event: "rpc-file-write-failed", error: rpcFile });
    app.quit();
    return;
  }
  rpcConnection = {
    origin: `http://${listening.renderer.host}:${listening.renderer.port}`,
    token: listening.renderer.token,
  };
  installMenu();
  await openMainWindow(rpcConnection);
  startAppUpdates({
    isDevelopment,
    getWindow: () => mainWindow,
  });
  logger.info({ event: "app-ready" });

  app.on("activate", () => {
    if (mainWindow !== undefined) return;
    if (rpcConnection === undefined) {
      throw new Error("Halo RPC is unavailable after startup.");
    }
    // oxlint-disable-next-line typescript/no-floating-promises -- Electron activate callbacks cannot await window loading.
    void openMainWindow(rpcConnection);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", (event) => {
  if (shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  // oxlint-disable-next-line typescript/no-floating-promises -- Electron requires will-quit to return while cleanup runs before the second quit call.
  void closeAppServices().finally(() => {
    logger.destroy();
    app.quit();
  });
});

async function closeAppServices() {
  const serverClosed = await haloServer.close();
  if (serverClosed instanceof Error) {
    logger.error({ event: "halo-server-close-failed", error: serverClosed });
  }
  const rpcFileRemoved = await removeHaloRpcFile({
    userDataDir: applicationConfig.dataDir,
  });
  if (rpcFileRemoved instanceof Error) {
    logger.error({ event: "rpc-file-remove-failed", error: rpcFileRemoved });
  }
  const filesystemClosed = await filesystemService.close();
  if (filesystemClosed instanceof Error) {
    logger.error({ event: "filesystem-close-failed", error: filesystemClosed });
  }
}

async function openMainWindow(connection: HaloRpcConnection): Promise<void> {
  const window = await createWindow(connection);
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
}

async function createWindow(
  connection: HaloRpcConnection,
): Promise<BrowserWindow> {
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
      additionalArguments: [
        `--halo-rpc-origin=${connection.origin}`,
        `--halo-rpc-token=${connection.token}`,
      ],
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

function assertTrustedSender(event: IpcMainEvent): BrowserWindow {
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

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Switch workspace",
    buttonLabel: "Switch workspace",
    properties: ["openDirectory"],
  });
  if (selection.canceled) return;
  const directory = selection.filePaths[0];
  if (directory === undefined) return;

  const previous = haloServer.getWorkspace();
  const workspace = await haloServer.selectWorkspace(directory);
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

function getRendererOrigin() {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
  }
  return "null";
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
