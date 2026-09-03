import type { LogLevel, LoggerData, LoggerScope } from "@repo/logger";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { contextBridge, ipcRenderer } from "electron";
import { LOG_CHANNELS } from "../shared/channels.js";
import { DESKTOP_CHANNEL, type DesktopApi } from "../shared/desktop.js";
import type { HaloRpcConnection } from "../shared/rpc.js";

const desktopApi: DesktopApi = {
  chooseWorkspace: () =>
    ipcRenderer.invoke(DESKTOP_CHANNEL, { type: "chooseWorkspace" }),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNEL, { type: "getAppInfo" }),
  installAppUpdate: () =>
    ipcRenderer.invoke(DESKTOP_CHANNEL, { type: "installAppUpdate" }),
  openExternal: (request) =>
    ipcRenderer.invoke(DESKTOP_CHANNEL, {
      type: "openExternal",
      url: request.url,
    }),
};

contextBridge.exposeInMainWorld("haloDesktop", desktopApi);
contextBridge.exposeInMainWorld("haloRpc", readHaloRpcConnection());

const logMessageSchema = Type.Object({
  channel: Type.Literal(LOG_CHANNELS.log),
  payload: Type.Object({
    level: Type.Union([
      Type.Literal("debug"),
      Type.Literal("info"),
      Type.Literal("warn"),
      Type.Literal("log"),
      Type.Literal("error"),
    ]),
    scopes: Type.Array(Type.Unknown()),
    data: Type.Unknown(),
  }),
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const log = parseLogMessage({ data: event.data });
  if (log !== undefined) {
    ipcRenderer.send(LOG_CHANNELS.log, log.payload);
  }
});

function readHaloRpcConnection(): HaloRpcConnection {
  return {
    origin: readArgument("--halo-rpc-origin="),
    token: readArgument("--halo-rpc-token="),
  };
}

function readArgument(prefix: string) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (argument === undefined) {
    throw new Error(`Halo preload is missing ${prefix.slice(2, -1)}.`);
  }
  return argument.slice(prefix.length);
}

type LogMessage = {
  channel: typeof LOG_CHANNELS.log;
  payload: {
    level: LogLevel;
    scopes: readonly LoggerScope[];
    data: LoggerData;
  };
};

function parseLogMessage(args: { data: unknown }): LogMessage | undefined {
  if (!Value.Check(logMessageSchema, args.data)) return undefined;
  // SAFETY: logMessageSchema is the halo:log window-message contract.
  return args.data as LogMessage;
}
