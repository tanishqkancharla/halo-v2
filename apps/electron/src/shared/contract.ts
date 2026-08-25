import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import {
  asyncIteratorObject,
  oc,
  type,
  type RouterContractClient,
} from "@orpc/contract";
import type { ClientId, RemoteApi } from "@tandem/types";
import type { AgentSessionState } from "./AgentSessionState.js";
import type { HaloSchema } from "./HaloTables.js";
import type { IntegrationConnection } from "./integrations.js";
import type {
  AppInfo,
  PluginLoadError,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const reservedPluginIds = [
  "new",
  "servers",
  "create",
  "build",
  "types",
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
  sync: {
    push: oc.input(type<Parameters<RemoteApi<HaloSchema>["push"]>[0]>()),
    pull: oc
      .input(type<Parameters<RemoteApi<HaloSchema>["pull"]>[0]>())
      .output(type<Awaited<ReturnType<RemoteApi<HaloSchema>["pull"]>>>()),
    connect: oc
      .input(type<{ clientId: ClientId }>())
      .output(asyncIteratorObject(type<{ type: "poke" }>())),
  },
  workspace: {
    get: oc.output(type<WorkspaceInfo | undefined>()),
    choose: oc.output(type<WorkspaceInfo | undefined>()),
    events: oc.output(asyncIteratorObject(type<WorkspaceTreeEvent[]>())),
  },
  sessions: {
    create: oc.output(type<{ sessionId: string }>()),
    open: oc
      .input(type<{ sessionId: string }>())
      .output(type<{ sessionId: string; state: AgentSessionState }>()),
    events: oc
      .input(type<{ sessionId: string }>())
      .output(asyncIteratorObject(type<AgentSessionEvent>())),
    prompt: oc.input(type<{ sessionId: string; text: string }>()),
    abort: oc.input(type<{ sessionId: string }>()),
    close: oc.input(type<{ sessionId: string }>()),
  },
  integrations: {
    startOAuth: oc
      .input(type<{ connectionId: string; sessionId: string }>())
      .output(type<IntegrationConnection>()),
    disconnect: oc.input(type<{ connectionId: string; sessionId: string }>()),
  },
  plugins: {
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
  },
};

export type HaloClient = RouterContractClient<typeof contract>;
