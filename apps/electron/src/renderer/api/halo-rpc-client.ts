import { newMessagePortRpcSession, type RpcStub } from "capnweb";
import * as errore from "errore";
import { RPC_CHANNELS } from "../../shared/rpc-channels.js";
import type {
  HaloRpcApi,
  SessionSummary,
  SessionTranscript,
  SystemApi,
  WorkspaceInfo,
} from "./SystemApi.js";

/**
 * Temporary adapter: Cap'n Web HaloRpcApi → existing SystemApi for the UI.
 * Remove once the renderer uses createAgentSession stubs directly.
 */
export function systemApiFromHaloRpc(halo: RpcStub<HaloRpcApi>): SystemApi {
  return {
    async getWorkspace() {
      return (await halo.getWorkspace()) as WorkspaceInfo | null;
    },
    async chooseWorkspace() {
      const value = await halo.chooseWorkspace();
      if (value instanceof Error) throw value;
      return value as WorkspaceInfo | null;
    },
    async listSessions() {
      const value = await halo.listSessions();
      if (value instanceof Error) throw value;
      return value as SessionSummary[];
    },
    async readSessionTranscript(sessionId) {
      const value = await halo.readSessionTranscript(sessionId);
      if (value instanceof Error) throw value;
      return value as SessionTranscript;
    },
    async createSession() {
      const value = await halo.createSession();
      if (value instanceof Error) throw value;
      return value as SessionSummary;
    },
    async sendPrompt(sessionId, prompt, onEvent) {
      await using cleanup = new errore.AsyncDisposableStack();
      const session = halo.createAgentSession(sessionId);
      cleanup.defer(() => {
        session[Symbol.dispose]();
      });
      await session.subscribe(onEvent);
      const value = await session.prompt(prompt);
      if (value instanceof Error) throw value;
    },
  };
}

export async function connectHaloRpc(): Promise<RpcStub<HaloRpcApi>> {
  const port = await requestRpcPort();
  return newMessagePortRpcSession<HaloRpcApi>(port);
}

function requestRpcPort(): Promise<MessagePort> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data !== RPC_CHANNELS.provideRpc) return;
      window.removeEventListener("message", onMessage);
      resolve(event.ports[0]!);
    };
    window.addEventListener("message", onMessage);
    window.postMessage(RPC_CHANNELS.requestRpc, "*");
  });
}
