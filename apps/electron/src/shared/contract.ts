import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import {
  asyncIteratorObject,
  oc,
  type,
  type RouterContractClient,
} from "@orpc/contract";
import type { AnyRouter, RouterClient } from "@orpc/server";
import type { AgentSessionState } from "./AgentSessionState.js";
import type { IntegrationConnection } from "./integrations.js";
import type {
  AppInfo,
  PluginList,
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const contract = {
  getAppInfo: oc.output(type<AppInfo>()),
  installAppUpdate: oc,
  getWorkspace: oc.output(type<WorkspaceInfo | undefined>()),
  chooseWorkspace: oc.output(type<WorkspaceInfo | undefined>()),
  listSessions: oc.output(type<SessionSummary[]>()),
  listWorkspacePaths: oc.output(type<string[]>()),
  listPlugins: oc.output(type<PluginList>()),
  subscribeWorkspaceTree: oc.output(
    asyncIteratorObject(type<WorkspaceTreeEvent[]>()),
  ),
  newAgentSession: oc.output(type<{ sessionId: string }>()),
  openAgentSession: oc
    .input(type<{ sessionId: string }>())
    .output(type<{ sessionId: string; state: AgentSessionState }>()),
  agentSession: {
    events: oc
      .input(type<{ sessionId: string }>())
      .output(asyncIteratorObject(type<AgentSessionEvent>())),
    prompt: oc.input(type<{ sessionId: string; text: string }>()),
    abort: oc.input(type<{ sessionId: string }>()),
    close: oc.input(type<{ sessionId: string }>()),
  },
  integrations: {
    get: oc
      .input(type<{ connectionId: string }>())
      .output(type<IntegrationConnection | undefined>()),
  },
};

export type HaloClient = RouterContractClient<typeof contract> & {
  plugins: Record<string, RouterClient<AnyRouter>>;
};
