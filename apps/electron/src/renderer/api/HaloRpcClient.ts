import { newMessagePortRpcSession, type RpcStub } from "capnweb";
import { RPC_CHANNELS } from "../../shared/channels.js";
import type {
  AgentSessionHandle,
  HaloRpcApi,
  SessionSummary,
  SessionTranscript,
  SystemApi,
  WorkspaceInfo,
} from "./SystemApi.js";

/** Cap'n Web HaloRpcApi → SystemApi (throws at the legacy UI boundary). */
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
    async createAgentSession(options = {}) {
      const value = await halo.createAgentSession(options);
      if (value instanceof Error) throw value;
      const sessionId = await value.sessionId;
      const session = value.session;
      const handle: AgentSessionHandle = {
        sessionId,
        subscribe(callback) {
          return session.subscribe(callback);
        },
        async prompt(text) {
          const result = await session.prompt(text);
          if (result instanceof Error) throw result;
        },
        async send(text) {
          const result = await session.send(text);
          if (result instanceof Error) throw result;
        },
        [Symbol.dispose]() {
          value[Symbol.dispose]();
        },
      };
      return handle;
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
