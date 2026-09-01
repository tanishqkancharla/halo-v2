import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import {
  asyncIteratorObject,
  oc,
  type,
  type RouterContractClient,
} from "@orpc/contract";
import type { AgentSessionState } from "./AgentSessionState.js";
import type { ConnectionRequest } from "./connectionRequests.js";
import type {
  AppInfo,
  PluginList,
  PluginLoadError,
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const reservedPluginIds = [
  "new",
  "servers",
  "create",
  "build",
  "types",
  "list",
  "check",
  "grant",
  "call",
] as const;

type PluginTypeDiagnostic = {
  id: string;
  file: string;
  line: number;
  message: string;
};

export type PluginInvocationInput = {
  pluginId: string;
  path: string[];
  input: unknown;
};

export const contract = {
  getAppInfo: oc.output(type<AppInfo>()),
  installAppUpdate: oc,
  workspace: {
    get: oc.output(type<WorkspaceInfo | undefined>()),
    choose: oc.output(type<WorkspaceInfo | undefined>()),
    listPaths: oc.output(type<string[]>()),
    events: oc.output(asyncIteratorObject(type<WorkspaceTreeEvent[]>())),
  },
  sessions: {
    list: oc.output(type<SessionSummary[]>()),
    create: oc.output(type<{ sessionId: string }>()),
    open: oc
      .input(type<{ sessionId: string }>())
      .output(type<{ sessionId: string; state: AgentSessionState }>()),
    events: oc
      .input(type<{ sessionId: string }>())
      .output(asyncIteratorObject(type<AgentSessionEvent>())),
    prompt: oc.input(type<{ sessionId: string; text: string }>()),
    startConnection:
      oc.input(type<{ sessionId: string; request: ConnectionRequest }>()),
    abort: oc.input(type<{ sessionId: string }>()),
    close: oc.input(type<{ sessionId: string }>()),
  },
  plugins: {
    list: oc.output(type<PluginList>()),
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
    invoke: oc.input(type<PluginInvocationInput>()).output(type<unknown>()),
    check: oc.input(type<{ pluginId: string }>()).output(
      type<{
        requested: string[];
        existing: string[];
        granted: string[];
        missing: string[];
      }>(),
    ),
    grant: oc.input(type<{ pluginId: string }>()).output(
      type<{
        requested: string[];
        existing: string[];
        granted: string[];
        newlyGranted: string[];
        missing: string[];
      }>(),
    ),
  },
};

export type HaloClient = RouterContractClient<typeof contract>;
