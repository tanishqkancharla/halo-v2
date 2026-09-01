import type { LogLevel, LoggerData, LoggerScope } from "@repo/logger";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ipcRenderer } from "electron";
import { LOG_CHANNELS, RPC_CHANNELS } from "../shared/channels.js";

const windowLoaded = new Promise<void>((resolve) => {
  window.addEventListener("load", () => resolve());
});

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

// Renderer requests an oRPC MessagePort; we forward it into the main world.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const log = parseLogMessage({ data: event.data });
  if (log !== undefined) {
    ipcRenderer.send(LOG_CHANNELS.log, log.payload);
    return;
  }
  if (event.data !== RPC_CHANNELS.requestRpc) return;
  // Electron IPC payload; the MessagePort is transferred separately.
  // oxlint-disable-next-line unicorn/no-null
  ipcRenderer.postMessage(RPC_CHANNELS.requestRpc, null);
});

ipcRenderer.on(RPC_CHANNELS.provideRpc, (event) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Electron owns this synchronous event callback; the message must wait for the window.
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

function parseLogMessage(args: { data: unknown }): LogMessage | undefined {
  if (!Value.Check(logMessageSchema, args.data)) return undefined;
  // SAFETY: logMessageSchema is the halo:log window-message contract.
  return args.data as LogMessage;
}
