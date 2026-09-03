import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { WorkspaceInfo } from "@get-halo/shared/rpc";
import {
  DESKTOP_CHANNEL,
  desktopRequestSchema,
  type DesktopRequest,
  type OpenExternalRequest,
} from "../shared/desktop.js";
import { getAppInfo, installAppUpdate } from "./app/AppUpdate.js";

class DesktopRequestError extends errore.createTaggedError({
  name: "DesktopRequestError",
  message: "Halo rejected an invalid $operation request",
}) {}

class DesktopOperationError extends errore.createTaggedError({
  name: "DesktopOperationError",
  message: "Halo could not $operation",
}) {}

export function registerDesktopApi(args: {
  selectWorkspace: (directory: string) => Promise<WorkspaceInfo | Error>;
  getWindow: () => BrowserWindow | undefined;
}): void {
  ipcMain.handle(DESKTOP_CHANNEL, async (event, request: DesktopRequest) => {
    const window = assertTrustedSender({ event, getWindow: args.getWindow });
    const validated = validateDesktopRequest(request);
    if (validated instanceof Error) throw validated;
    const result = await handleDesktopRequest({
      request: validated,
      window,
      selectWorkspace: args.selectWorkspace,
    });
    if (result instanceof Error) throw result;
    return result;
  });
}

function validateDesktopRequest(
  request: DesktopRequest,
): DesktopRequest | DesktopRequestError {
  if (Value.Check(desktopRequestSchema, request)) return request;
  return new DesktopRequestError({ operation: "desktop API" });
}

async function handleDesktopRequest(args: {
  request: DesktopRequest;
  window: BrowserWindow;
  selectWorkspace: (directory: string) => Promise<WorkspaceInfo | Error>;
}) {
  switch (args.request.type) {
    case "chooseWorkspace":
      return chooseWorkspace({
        window: args.window,
        selectWorkspace: args.selectWorkspace,
      });
    case "getAppInfo":
      return getAppInfo();
    case "installAppUpdate":
      return installAppUpdate();
    case "openExternal":
      return openExternal(args.request);
    default:
      return new DesktopRequestError({ operation: "desktop API" });
  }
}

async function chooseWorkspace(args: {
  window: BrowserWindow;
  selectWorkspace: (directory: string) => Promise<WorkspaceInfo | Error>;
}) {
  const selection = await dialog
    .showOpenDialog(args.window, {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    })
    .catch(
      (e) =>
        new DesktopOperationError({
          operation: "open the workspace picker",
          cause: e,
        }),
    );
  if (selection instanceof Error) return selection;
  if (selection.canceled) return undefined;
  return args.selectWorkspace(selection.filePaths[0]!);
}

async function openExternal(request: OpenExternalRequest) {
  const url = errore.try({
    try: () => new URL(request.url),
    catch: (e) =>
      new DesktopOperationError({
        operation: "open an invalid external URL",
        cause: e,
      }),
  });
  if (url instanceof Error) return url;
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return new DesktopOperationError({
      operation: `open an external ${url.protocol} URL`,
    });
  }
  return shell
    .openExternal(url.toString())
    .catch(
      (e) => new DesktopOperationError({ operation: "open the URL", cause: e }),
    );
}

function assertTrustedSender(args: {
  event: IpcMainInvokeEvent;
  getWindow: () => BrowserWindow | undefined;
}): BrowserWindow {
  const window = args.getWindow();
  const senderWindow = BrowserWindow.fromWebContents(args.event.sender);
  if (senderWindow === null || senderWindow !== window) {
    throw new Error("Halo rejected IPC from an unknown renderer.");
  }
  return senderWindow;
}
