import { ipcRenderer } from "electron";
import { RPC_CHANNELS } from "../shared/channels.js";

const windowLoaded = new Promise<void>((resolve) => {
  window.addEventListener("load", () => resolve());
});

// Renderer requests a Cap'n Web MessagePort; we forward it into the main world.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data !== RPC_CHANNELS.requestRpc) return;
  ipcRenderer.postMessage(RPC_CHANNELS.requestRpc, null);
});

ipcRenderer.on(RPC_CHANNELS.provideRpc, (event) => {
  void windowLoaded.then(() => {
    window.postMessage(RPC_CHANNELS.provideRpc, "*", event.ports);
  });
});
