import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import {
  DESKTOP_CHANNELS,
  emptyDesktopRequestSchema,
  openExternalRequestSchema,
  type EmptyDesktopRequest,
  type OpenExternalRequest,
} from "../shared/desktop.js";
import { getAppInfo, installAppUpdate } from "./app/AppUpdate.js";
import type { WorkspaceService } from "./workspace/WorkspaceService.js";

class DesktopRequestError extends errore.createTaggedError({
  name: "DesktopRequestError",
  message: "Halo rejected an invalid $operation request",
}) {}

class DesktopOperationError extends errore.createTaggedError({
  name: "DesktopOperationError",
  message: "Halo could not $operation",
}) {}

export function registerDesktopApi(args: {
  workspace: WorkspaceService;
  getWindow: () => BrowserWindow | undefined;
}): void {
  ipcMain.handle(
    DESKTOP_CHANNELS.chooseWorkspace,
    async (event, request: EmptyDesktopRequest) => {
      const window = assertTrustedSender({ event, getWindow: args.getWindow });
      const validated = validateEmptyDesktopRequest({
        operation: "choose workspace",
        request,
      });
      if (validated instanceof Error) throw validated;
      const workspace = await chooseWorkspace({
        window,
        workspace: args.workspace,
      });
      if (workspace instanceof Error) throw workspace;
      return workspace;
    },
  );
  ipcMain.handle(
    DESKTOP_CHANNELS.getAppInfo,
    (event, request: EmptyDesktopRequest) => {
      assertTrustedSender({ event, getWindow: args.getWindow });
      const validated = validateEmptyDesktopRequest({
        operation: "get app info",
        request,
      });
      if (validated instanceof Error) throw validated;
      return getAppInfo();
    },
  );
  ipcMain.handle(
    DESKTOP_CHANNELS.installAppUpdate,
    (event, request: EmptyDesktopRequest) => {
      assertTrustedSender({ event, getWindow: args.getWindow });
      const validated = validateEmptyDesktopRequest({
        operation: "install app update",
        request,
      });
      if (validated instanceof Error) throw validated;
      const installed = installAppUpdate();
      if (installed instanceof Error) throw installed;
    },
  );
  ipcMain.handle(
    DESKTOP_CHANNELS.openExternal,
    async (event, request: OpenExternalRequest) => {
      assertTrustedSender({ event, getWindow: args.getWindow });
      const validated = validateOpenExternalRequest(request);
      if (validated instanceof Error) throw validated;
      const opened = await openExternal(validated);
      if (opened instanceof Error) throw opened;
    },
  );
}

function validateEmptyDesktopRequest(args: {
  operation: string;
  request: EmptyDesktopRequest;
}): EmptyDesktopRequest | DesktopRequestError {
  if (Value.Check(emptyDesktopRequestSchema, args.request)) return args.request;
  return new DesktopRequestError({ operation: args.operation });
}

function validateOpenExternalRequest(
  request: OpenExternalRequest,
): OpenExternalRequest | DesktopRequestError {
  if (Value.Check(openExternalRequestSchema, request)) return request;
  return new DesktopRequestError({ operation: "open external URL" });
}

async function chooseWorkspace(args: {
  window: BrowserWindow;
  workspace: WorkspaceService;
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
  return args.workspace.select(selection.filePaths[0]!);
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
