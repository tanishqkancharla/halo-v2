import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { HaloManifest } from "@get-halo/plugin-sdk/schema";
import {
  asyncIteratorObject,
  oc,
  type,
  type RouterContractClient,
} from "@orpc/contract";
import type { AgentSessionState } from "./AgentSessionState.js";
import type { ConnectionRequest } from "./connectionRequests.js";
import type {
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export type ServerInfo = {
  version: string;
};

export type ConnectionStarted =
  | { status: "connected" }
  | {
      status: "authorization-required";
      authorizationUrl: string;
      connectionId: string;
    };

export type ConnectionEvent = {
  type: "halo.connection";
  request: ConnectionRequest;
  status: "connected" | "cancelled";
};

export type HaloSessionEvent = AgentSessionEvent | ConnectionEvent;

export type PluginManifest = {
  id: string;
  directory: string;
  packageName: string;
  halo: HaloManifest;
  viewPath?: string;
  serverPath?: string;
};

export type PluginLoadError = {
  id: string;
  message: string;
};

export type CompiledPluginView = {
  id: string;
  source: string;
};

export type PluginList = {
  plugins: PluginManifest[];
  compiledViews: CompiledPluginView[];
  errors: PluginLoadError[];
};

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
  getServerInfo: oc.output(type<ServerInfo>()),
  workspace: {
    get: oc.output(type<WorkspaceInfo | undefined>()),
    listPaths: oc.output(type<string[]>()),
    readFile: oc.input(type<{ path: string }>()).output(type<string>()),
    writeFile: oc
      .input(type<{ path: string; content: string }>())
      .output(type<{ path: string }>()),
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
      .output(asyncIteratorObject(type<HaloSessionEvent>())),
    prompt: oc.input(type<{ sessionId: string; text: string }>()),
    startConnection: oc
      .input(type<{ sessionId: string; request: ConnectionRequest }>())
      .output(type<ConnectionStarted>()),
    cancelConnection:
      oc.input(type<{ sessionId: string; connectionId: string }>()),
    abort: oc.input(type<{ sessionId: string }>()),
    close: oc.input(type<{ sessionId: string }>()),
  },
  plugins: {
    list: oc.output(type<PluginList>()),
    create: oc
      .input(type<{ id: string; storage?: boolean }>())
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
