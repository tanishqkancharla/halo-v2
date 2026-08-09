import type { LogLevel, LoggerData } from "@repo/logger";
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
    data: LoggerData;
  };
};

function isLogMessage(data: unknown): data is LogMessage {
  if (typeof data !== "object" || data === null) return false;
  if (!("channel" in data) || data.channel !== LOG_CHANNELS.log) return false;
  if (!("payload" in data) || typeof data.payload !== "object") return false;
  if (data.payload === null) return false;
  if (!("level" in data.payload) || !("data" in data.payload)) return false;
  return true;
}
