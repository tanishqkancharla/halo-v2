import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type IpcMainInvokeEvent,
} from "electron";
import started from "electron-squirrel-startup";
import { IPC } from "./ipc.js";
import { PiService } from "./pi-service.js";
import { WorkspaceService } from "./workspace-service.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const currentDirectory = dirname(fileURLToPath(import.meta.url));

if (started) app.quit();

loadDevelopmentEnvironment();
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
  app.commandLine.appendSwitch("remote-debugging-port", "4445");
}

const workspaceService = new WorkspaceService();
const piService = new PiService(workspaceService);
let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  registerIpcHandlers();
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

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.getWorkspace, (event) => {
    assertTrustedSender(event);
    return workspaceService.getWorkspace();
  });
  ipcMain.handle(IPC.chooseWorkspace, async (event) => {
    const window = assertTrustedSender(event);
    const selection = await dialog.showOpenDialog(window, {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return null;
    return workspaceService.select(selection.filePaths[0]!);
  });
  ipcMain.handle(IPC.listSessions, (event) => {
    assertTrustedSender(event);
    return piService.listSessions();
  });
  ipcMain.handle(IPC.readSessionTranscript, (event, sessionId: string) => {
    assertTrustedSender(event);
    return piService.readTranscript(sessionId);
  });
  ipcMain.handle(IPC.createSession, (event) => {
    assertTrustedSender(event);
    return piService.createNewSession();
  });
  ipcMain.handle(
    IPC.sendPrompt,
    async (event, requestId: string, sessionId: string, prompt: string) => {
      assertTrustedSender(event);
      await piService.sendPrompt(sessionId, prompt, (promptEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC.promptEvent, {
            requestId,
            event: promptEvent,
          });
        }
      });
    },
  );
}

function assertTrustedSender(event: IpcMainInvokeEvent): BrowserWindow {
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

function loadDevelopmentEnvironment(): void {
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) return;
  const appDirectory = join(currentDirectory, "../..");
  const repositoryRoot = join(appDirectory, "../..");
  const environmentFile = [
    join(appDirectory, ".env"),
    join(repositoryRoot, ".env"),
  ].find(existsSync);
  if (environmentFile !== undefined) process.loadEnvFile(environmentFile);
}
