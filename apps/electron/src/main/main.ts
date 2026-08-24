import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MessageChannelMain,
  shell,
  type IpcMainEvent,
} from "electron";
import { existsSync } from "node:fs";
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
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/message-port";
import started from "electron-squirrel-startup";
import { LOG_CHANNELS, RPC_CHANNELS } from "../shared/channels.js";
import { getApplicationConfig, getLogFilePath } from "./ApplicationConfig.js";
import { AgentSessionRegistry } from "./AgentSessionRegistry.js";
import { checkForUpdates, startAppUpdates } from "./AppUpdate.js";
import { listenHaloRpcHttp, type HaloRpcHttp } from "./HaloRpcHttp.js";
import { IntegrationService } from "./IntegrationService.js";
import { resolveHaloCliEntry } from "./installHaloCli.js";
import { PiService } from "./pi-service.js";
import { PluginService } from "./plugins/PluginService.js";
import { haloRpcRouter, type HaloContext } from "./router.js";
import { UserService } from "./UserService.js";
import { WorkspaceService } from "./workspace-service.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);

if (started) app.quit();

loadDevelopmentEnvironment();
configureUserDataPath();

const applicationConfig = getApplicationConfig({ isDevelopment });
const logger = new Logger({
  sinks: [
    new PrettyConsoleLoggerSink(),
    new JsonlLoggerSink({ filePath: getLogFilePath(applicationConfig) }),
  ],
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

const workspaceService = new WorkspaceService(applicationConfig.dataDir, {
  appVersion: app.getVersion(),
  cliEntry: resolveHaloCliEntry(import.meta.url),
  cliNodeExecutable: isDevelopment ? "node" : process.execPath,
  cliElectronRunAsNode: !isDevelopment,
  isDevelopment,
});
const userService = new UserService(applicationConfig.dataDir);
const integrationService = new IntegrationService(workspaceService);
const piService = new PiService(
  workspaceService,
  userService,
  integrationService,
);
const pluginService = new PluginService(workspaceService);
let mainWindow: BrowserWindow | undefined;
let rpcHttp: HaloRpcHttp | undefined;

app.whenReady().then(async () => {
  await workspaceService.restore();
  registerLogBridge();
  registerRpcBridge();
  const listening = await listenHaloRpcHttp({
    context: {
      workspace: workspaceService,
      integrations: integrationService,
      pi: piService,
      plugins: pluginService,
      sessions: new AgentSessionRegistry(),
      getWindow: () => {
        if (mainWindow === undefined) {
          throw new Error("Halo main window is not open.");
        }
        return mainWindow;
      },
      logger: rpcLogger,
    },
    userDataDir: applicationConfig.dataDir,
  });
  if (listening instanceof Error) {
    logger.error({ event: "rpc-http-listen-failed", error: listening });
  } else {
    rpcHttp = listening;
  }
  installMenu();
  openMainWindow();
  startAppUpdates({
    isDevelopment,
    getWindow: () => mainWindow,
  });
  logger.info({ event: "app-ready" });

  app.on("activate", () => {
    if (mainWindow === undefined) openMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", (event) => {
  if (rpcHttp === undefined) {
    logger.destroy();
    return;
  }
  event.preventDefault();
  const pending = rpcHttp;
  rpcHttp = undefined;
  void pending.close().finally(() => {
    logger.destroy();
    app.quit();
  });
});

function openMainWindow(): void {
  const window = createWindow();
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
}

function createWindow(): BrowserWindow {
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
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
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
      let log = rendererLogger;
      for (const scope of payload.scopes) {
        for (const [name, scopeData] of Object.entries(scope)) {
          log = log.scope(name, scopeData);
        }
      }
      log[payload.level](payload.data);
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
    const context: HaloContext = {
      workspace: workspaceService,
      integrations: integrationService,
      pi: piService,
      plugins: pluginService,
      sessions: new AgentSessionRegistry(),
      getWindow: () => {
        if (mainWindow === undefined) {
          throw new Error("Halo main window is not open.");
        }
        return mainWindow;
      },
      logger: rpcLogger,
    };
    const handler = new RPCHandler(haloRpcRouter(pluginService), {
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
    handler.upgrade(port1, { context });
    port1.start();
    port1.on("close", () => {
      context.sessions.closeAll();
    });
    // Electron's postMessage payload; the ports carry the RPC transport.
    // oxlint-disable-next-line unicorn/no-null
    frame.postMessage(RPC_CHANNELS.provideRpc, null, [port2]);
  });
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
      void openLogs();
    },
  };
  const switchWorkspaceItem = {
    label: "Switch Workspace…",
    click: () => {
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
  void dialog.showMessageBox(mainWindow, {
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

  const previous = workspaceService.getWorkspace();
  const workspace = await workspaceService.select(directory);
  if (workspace instanceof Error) {
    void dialog.showMessageBox(mainWindow, {
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

function configureUserDataPath(): void {
  if (!isDevelopment) return;
  const appDirectory = join(currentDirectory, "../..");
  app.setPath("userData", join(appDirectory, "../..", ".halo"));
}

function loadDevelopmentEnvironment(): void {
  if (!isDevelopment) return;
  const appDirectory = join(currentDirectory, "../..");
  const environmentFile = [
    join(appDirectory, ".env"),
    join(appDirectory, "../../.env"),
  ].find(existsSync);
  if (environmentFile !== undefined) process.loadEnvFile(environmentFile);
}
