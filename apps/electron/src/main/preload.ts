import type { LogLevel, LoggerData, LoggerScope } from "@repo/logger";
import { ipcRenderer } from "electron";
import { LOG_CHANNELS, RPC_CHANNELS } from "../shared/channels.js";

const windowLoaded = new Promise<void>((resolve) => {
  window.addEventListener("load", () => resolve());
});

// Renderer requests a Cap'n Web MessagePort; we forward it into the main world.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (isLogMessage(event.data)) {
    ipcRenderer.send(LOG_CHANNELS.log, event.data.payload);
    return;
  }
  if (event.data !== RPC_CHANNELS.requestRpc) return;
  // Electron IPC payload; the MessagePort is transferred separately.
  // oxlint-disable-next-line unicorn/no-null
  ipcRenderer.postMessage(RPC_CHANNELS.requestRpc, null);
});

ipcRenderer.on(RPC_CHANNELS.provideRpc, (event) => {
  void windowLoaded.then(() => {
    window.postMessage(RPC_CHANNELS.provideRpc, "*", event.ports);
  });
});

type LogMessage = {
  channel: typeof LOG_CHANNELS.log;
  payload: {
    level: LogLevel;
    scopes: readonly LoggerScope[];
    data: LoggerData;
  };
};

type WindowMessage = LogMessage | typeof RPC_CHANNELS.requestRpc;

function isRecord(value: WindowMessage): value is LogMessage {
  return typeof value === "object" && value !== null;
}

function isLogMessage(data: WindowMessage): data is LogMessage {
  if (!isRecord(data)) return false;
  if (data.channel !== LOG_CHANNELS.log) return false;
  if (!("payload" in data)) return false;
  const payload = data.payload;
  if (payload === null || typeof payload !== "object") return false;
  if (!("level" in payload) || !("scopes" in payload) || !("data" in payload)) {
    return false;
  }
  return true;
}
