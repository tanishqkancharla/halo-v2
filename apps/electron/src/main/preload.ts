import { ipcRenderer } from "electron";
import { IPC } from "./ipc.js";

const windowLoaded = new Promise<void>((resolve) => {
  window.addEventListener("load", () => resolve());
});

// Renderer requests a Cap'n Web MessagePort; we forward it into the main world.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data !== IPC.requestRpc) return;
  ipcRenderer.postMessage(IPC.requestRpc, null);
});

ipcRenderer.on(IPC.provideRpc, (event) => {
  void windowLoaded.then(() => {
    window.postMessage(IPC.provideRpc, "*", event.ports);
  });
});
