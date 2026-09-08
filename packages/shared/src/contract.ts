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
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const haloProtocolVersion = 5 as const;

export const RequestRejectedError = error("BAD_REQUEST", {
  message: "Halo could not complete the request.",
  data: type<{ message: string }>(),
});

const publicProcedure = oc.errors({
  [RequestRejectedError.code]: RequestRejectedError,
});

export type ConnectionStarted =
  | { status: "connected" }
  | {
      status: "authorization-required";
      authorizationUrl: string;
      connectionId: string;
      expiresInMs: number;
    };

export type ExtensionSummary = {
  id: string;
  url: string;
  displayName: string;
  icon?: string;
};
export type ExtensionPermissionRequest = {
  id: string;
  displayName: string;
  paths: string[];
};
export type ExtensionPermissionReport = {
  displayName: string;
  requested: string[];
  existing: string[];
  granted: string[];
  pending: string[];
  missing: string[];
};

const browserSnapshot = type<{
  url: string;
  title: string;
  tree: string;
  errors: string[];
}>();
const browserExecution = type<{
  result: unknown;
  stdout: string;
  stderr: string;
  snapshotDiff: string;
  errors: string[];
}>();

export const contract = publicProcedure.router({
  server: {
    info: oc.output(type<{ protocolVersion: typeof haloProtocolVersion }>()),
  },
  browser: {
    open: oc.input(type<{ url: string }>()).output(
      type<{
        id: string;
        url: string;
        title: string;
        tree: string;
        errors: string[];
      }>(),
    ),
    list: oc.output(type<Array<{ id: string; url: string }>>()),
    exec: oc
      .input(type<{ id: string; source: string }>())
      .output(browserExecution),
    snapshot: oc.input(type<{ id: string }>()).output(browserSnapshot),
    screenshot: oc
      .input(type<{ id: string }>())
      .output(type<{ path: string }>()),
    close: oc.input(type<{ id: string }>()).output(type<void>()),
  },
  app: {
    exec: oc.input(type<{ source: string }>()).output(browserExecution),
    snapshot: oc.output(browserSnapshot),
    screenshot: oc.output(type<{ path: string }>()),
  },
  extensions: {
    list: oc.output(type<ExtensionSummary[]>()),
    reload: oc.output(type<void>()),
    tools: {
      add: oc
        .input(type<{ id: string; paths: string[] }>())
        .output(type<ExtensionPermissionReport>()),
      check: oc
        .input(type<{ id: string }>())
        .output(type<ExtensionPermissionReport>()),
      requests: oc.output(
        asyncIteratorObject(type<ExtensionPermissionRequest[]>()),
      ),
      decide: oc
        .input(
          type<{
            id: string;
            paths: string[];
            action: "allow" | "deny" | "revoke";
          }>(),
        )
        .output(type<ExtensionPermissionReport>()),
    },
  },
  workspace: {
    get: oc.output(type<WorkspaceInfo>()),
    listPaths: oc.output(type<string[]>()),
    createEntry: oc
      .input(type<{ path: string; kind: "file" | "directory" }>())
      .output(type<{ path: string }>()),
    moveEntry: oc
      .input(type<{ source: string; destination: string }>())
      .output(type<{ path: string }>()),
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
    invokeTool: oc
      .input(type<{ path: string; input: unknown }>())
      .output(type<unknown>()),
    appendSessionEvents:
      oc.input(type<{ sessionId: string; events: SessionLogEvent[] }>()),
    getToolIdentity: oc
      .input(type<{ path: string }>())
      .output(type<ToolIdentity>()),
  },
});

export type HaloClient = RouterContractClient<typeof contract>;
