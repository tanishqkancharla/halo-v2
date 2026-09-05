import {
  asyncIteratorObject,
  error,
  oc,
  type,
  type RouterContractClient,
} from "@orpc/contract";
import type { ConnectionRequest } from "./connectionRequests.js";
import type {
  SessionLogEvent,
  SessionLogRecord,
  ToolIdentity,
} from "./sessionLog.js";
import type {
  PluginList,
  PluginLoadError,
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const haloProtocolVersion = 3 as const;

export const RequestRejectedError = error("BAD_REQUEST", {
  message: "Halo could not complete the request.",
  data: type<{ message: string }>(),
});

export const PluginInvocationError = error("PLUGIN_ERROR", {
  message: "Halo could not invoke the plugin.",
  data: type<{ message: string }>(),
});

const publicProcedure = oc.errors({
  [RequestRejectedError.code]: RequestRejectedError,
});

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

export type ConnectionStarted =
  | { status: "connected" }
  | {
      status: "authorization-required";
      authorizationUrl: string;
      connectionId: string;
      expiresInMs: number;
    };

export const contract = publicProcedure.router({
  server: {
    info: oc.output(type<{ protocolVersion: typeof haloProtocolVersion }>()),
  },
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
    open: oc.input(type<{ sessionId: string }>()).output(
      type<{
        sessionId: string;
        records: SessionLogRecord[];
        cursor: number;
      }>(),
    ),
    events: oc
      .input(type<{ sessionId: string; afterSequence?: number }>())
      .output(asyncIteratorObject(type<SessionLogRecord>())),
    prompt: oc.input(type<{ sessionId: string; text: string }>()),
    startConnection: oc
      .input(type<{ sessionId: string; request: ConnectionRequest }>())
      .output(type<ConnectionStarted>()),
    cancelConnection:
      oc.input(type<{ sessionId: string; connectionId: string }>()),
    abort: oc.input(type<{ sessionId: string }>()),
    close: oc.input(type<{ sessionId: string }>()),
  },
  testHarness: {
    appendSessionEvents:
      oc.input(type<{ sessionId: string; events: SessionLogEvent[] }>()),
    getToolIdentity: oc
      .input(type<{ path: string }>())
      .output(type<ToolIdentity>()),
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
    invoke: oc
      .input(type<PluginInvocationInput>())
      .output(type<unknown>())
      .errors({
        [PluginInvocationError.code]: PluginInvocationError,
      }),
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
});

export type HaloClient = RouterContractClient<typeof contract>;
