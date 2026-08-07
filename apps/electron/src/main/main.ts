import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  MessageChannelMain,
  type IpcMainEvent,
} from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import started from "electron-squirrel-startup";
import { HaloRpc } from "./halo-rpc.js";
import { newMessagePortMainRpcSession } from "./message-port-main-transport.js";
import { PiService } from "./pi-service.js";
import { WorkspaceService } from "./workspace-service.js";
import { RPC_CHANNELS } from "../shared/rpc-channels.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);

if (started) app.quit();

loadDevelopmentEnvironment();
configureUserDataPath();
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

const workspaceService = new WorkspaceService(app.getPath("userData"));
const piService = new PiService(workspaceService);
let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  await workspaceService.restore();
  registerRpcBridge();
  installMenu();
  openMainWindow();

  app.on("activate", () => {
    if (mainWindow === null) openMainWindow();
  });
});

app.on("before-quit", (event) => {
  if (piServiceIsStopped) return;
  event.preventDefault();
  piServiceIsStopped = true;
  void piService.shutdown().then(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

let piServiceIsStopped = false;

function openMainWindow(): void {
  const window = createWindow();
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
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

function registerRpcBridge(): void {
  ipcMain.on(RPC_CHANNELS.requestRpc, (event) => {
    assertTrustedSender(event);
    const frame = event.senderFrame;
    if (frame === null) {
      throw new Error("Halo rejected RPC without a sender frame.");
    }
    const { port1, port2 } = new MessageChannelMain();
    newMessagePortMainRpcSession(
      port1,
      new HaloRpc(workspaceService, piService, () => {
        if (mainWindow === null) {
          throw new Error("Halo main window is not open.");
        }
        return mainWindow;
      }),
    );
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
  if (process.platform !== "darwin") return;
  const menu = Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.reload(),
        },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
  ]);
  Menu.setApplicationMenu(menu);
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
