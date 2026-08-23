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
  PluginLoadError,
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const reservedPluginIds = ["new", "build", "types"] as const;

export type PluginTypeDiagnostic = {
  id: string;
  file: string;
  line: number;
  message: string;
};

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
    startOAuth: oc
      .input(type<{ connectionId: string; sessionId: string }>())
      .output(type<IntegrationConnection>()),
    disconnect: oc.input(type<{ connectionId: string; sessionId: string }>()),
  },
  plugin: {
    create: oc
      .input(type<{ id: string }>())
      .output(type<{ id: string; directory: string }>()),
    build: oc.output(type<{ built: string[]; errors: PluginLoadError[] }>()),
    types:
      oc.output(
        type<{
          written: string[];
          diagnostics: PluginTypeDiagnostic[];
        }>(),
      ),
  },
};

export type HaloClient = RouterContractClient<typeof contract> & {
  plugins: Record<string, RouterClient<AnyRouter>>;
};
