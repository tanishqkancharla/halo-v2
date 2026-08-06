import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { PromptEventHandler, SystemApi } from "../src/api/SystemApi.js";
import { IPC, type PromptEventEnvelope } from "./ipc.js";

const haloApi: SystemApi = {
  getWorkspace() {
    return ipcRenderer.invoke(IPC.getWorkspace);
  },

  chooseWorkspace() {
    return ipcRenderer.invoke(IPC.chooseWorkspace);
  },

  listSessions() {
    return ipcRenderer.invoke(IPC.listSessions);
  },

  readSessionTranscript(sessionId) {
    return ipcRenderer.invoke(IPC.readSessionTranscript, sessionId);
  },

  createSession() {
    return ipcRenderer.invoke(IPC.createSession);
  },

  sendPrompt(sessionId, prompt, onEvent) {
    return invokePrompt(sessionId, prompt, onEvent);
  },
};

async function invokePrompt(
  sessionId: string,
  prompt: string,
  onEvent: PromptEventHandler,
): Promise<void> {
  const requestId = crypto.randomUUID();
  const listener = (
    _event: IpcRendererEvent,
    envelope: PromptEventEnvelope,
  ) => {
    if (envelope.requestId === requestId) onEvent(envelope.event);
  };
  ipcRenderer.on(IPC.promptEvent, listener);
  try {
    await ipcRenderer.invoke(IPC.sendPrompt, requestId, sessionId, prompt);
  } finally {
    ipcRenderer.off(IPC.promptEvent, listener);
  }
}

contextBridge.exposeInMainWorld("halo", haloApi);
