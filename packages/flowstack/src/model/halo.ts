import { event, frame, type Program, type Service } from "./Program.js";

const services: Service[] = [
  {
    id: "human",
    name: "Human",
    process: "outside",
    description: "The person at the keyboard.",
    state: [],
    composes: [],
  },
  {
    id: "inference",
    name: "Inference provider",
    process: "outside",
    description: "The model API Pi calls for completions.",
    state: [],
    composes: [],
  },
  {
    id: "disk",
    name: "Disk",
    process: "outside",
    description: "The workspace filesystem, where Pi keeps transcripts.",
    state: [],
    composes: [],
  },
  {
    id: "renderer",
    name: "Renderer",
    process: "renderer",
    description:
      "The Chromium window: React UI, the oRPC client, and the preload bridge.",
    state: [],
    composes: [
      "composer",
      "agentSessionHook",
      "sessionState",
      "apiProvider",
      "haloRpcClient",
      "filesystemSection",
      "preload",
    ],
  },
  {
    id: "main",
    name: "Main process",
    process: "main",
    description:
      "The Node process: Electron main, the oRPC handler, and the Halo server that hosts Pi.",
    state: [],
    composes: ["electronMain", "rpcHandler", "haloRpcHttp", "haloServer"],
  },
  {
    id: "composer",
    name: "Composer",
    process: "renderer",
    description: "The message editor at the bottom of a session pane.",
    state: [{ name: "draft", type: "string" }],
    composes: [],
  },
  {
    id: "agentSessionHook",
    name: "useAgentSession",
    process: "renderer",
    description:
      "Opens a saved Pi session and folds its event stream into view state.",
    state: [
      { name: "readySessionId", type: "string | undefined" },
      { name: "state", type: "AgentSessionState" },
    ],
    composes: ["sessionState"],
  },
  {
    id: "sessionState",
    name: "AgentSessionState",
    process: "renderer",
    description: "Pure reducer shared by the renderer and the server.",
    state: [],
    composes: [],
  },
  {
    id: "apiProvider",
    name: "ApiProvider",
    process: "renderer",
    description: "TanStack Query client that caches every RPC read.",
    state: [
      { name: "workspace", type: "WorkspaceState" },
      { name: "sessions", type: "SessionSummary[]" },
      { name: "workspace-paths", type: "string[]" },
      { name: "plugins", type: "PluginsQueryData" },
    ],
    composes: ["haloRpcClient"],
  },
  {
    id: "haloRpcClient",
    name: "HaloRpcClient",
    process: "renderer",
    description: "oRPC client over a MessagePort handed in by the preload.",
    state: [{ name: "port", type: "MessagePort" }],
    composes: [],
  },
  {
    id: "filesystemSection",
    name: "FilesystemSection",
    process: "renderer",
    description: "Sidebar file tree built from the workspace-paths query.",
    state: [],
    composes: ["apiProvider"],
  },
  {
    id: "preload",
    name: "preload",
    process: "preload",
    description:
      "Sandboxed bridge. Forwards window messages to ipcRenderer and back.",
    state: [{ name: "windowLoaded", type: "Promise<void>" }],
    composes: [],
  },
  {
    id: "electronMain",
    name: "main.ts",
    process: "main",
    description: "Electron lifecycle, window, menu, and IPC bridges.",
    state: [
      { name: "mainWindow", type: "BrowserWindow | undefined" },
      { name: "rpcHttp", type: "HaloRpcHttp | undefined" },
      { name: "shutdownStarted", type: "boolean" },
    ],
    composes: ["rpcHandler", "haloRpcHttp", "haloServer"],
  },
  {
    id: "rpcHandler",
    name: "RPCHandler",
    process: "main",
    description: "oRPC message-port handler bound to haloRpcRouter.",
    state: [],
    composes: ["sessionsRouter", "workspaceRouter"],
  },
  {
    id: "haloRpcHttp",
    name: "HaloRpcHttp",
    process: "main",
    description:
      "Loopback HTTP for the halo CLI and the OAuth callback. Same router, bearer token.",
    state: [
      { name: "token", type: "string" },
      { name: "port", type: "number" },
    ],
    composes: ["sessionsRouter", "workspaceRouter", "toolRuntimeService"],
  },
  {
    id: "haloServer",
    name: "HaloServer",
    process: "main",
    description: "Wires the services and owns the router context.",
    state: [{ name: "context", type: "HaloContext" }],
    composes: [
      "workspaceService",
      "pluginService",
      "sessionRegistry",
      "toolRuntimeService",
    ],
  },
  {
    id: "sessionsRouter",
    name: "sessionsRouter",
    process: "main",
    description: "Implements contract.sessions.",
    state: [],
    composes: ["sessionRegistry", "toolRuntimeService"],
  },
  {
    id: "workspaceRouter",
    name: "workspaceRouter",
    process: "main",
    description: "Implements contract.workspace.",
    state: [],
    composes: ["workspaceService"],
  },
  {
    id: "sessionRegistry",
    name: "SessionRegistry",
    process: "main",
    description: "Live Pi sessions keyed by id.",
    state: [
      { name: "sessions", type: "Map<string, HaloAgentSession>" },
      { name: "opening", type: "Map<string, Promise<HaloAgentSession>>" },
    ],
    composes: ["haloAgentSession"],
  },
  {
    id: "haloAgentSession",
    name: "HaloAgentSession",
    process: "main",
    description: "Wraps one Pi AgentSession and republishes its events.",
    state: [
      { name: "piSession", type: "AgentSession" },
      { name: "eventStream", type: "Stream<AgentSessionEvent>" },
    ],
    composes: ["piAgentSession", "stream"],
  },
  {
    id: "piAgentSession",
    name: "Pi AgentSession",
    process: "main",
    description: "The Pi coding agent loop, with Halo's custom tools.",
    state: [
      { name: "messages", type: "AgentMessage[]" },
      { name: "isStreaming", type: "boolean" },
      { name: "sessions/<id>.jsonl", type: "transcript on disk" },
    ],
    composes: [],
  },
  {
    id: "stream",
    name: "Stream",
    process: "main",
    description: "Push stream with subscribe() and an async consume().",
    state: [{ name: "subscribers", type: "Set<(value) => void>" }],
    composes: [],
  },
  {
    id: "workspaceService",
    name: "WorkspaceService",
    process: "main",
    description: "The chosen folder, its Pi layout, and its file tree events.",
    state: [
      { name: "state", type: "notStarted | ready { layout }" },
      { name: "directoryPaths", type: "Set<string>" },
      { name: "treeEventStream", type: "Stream<WorkspaceTreeEvent[]>" },
    ],
    composes: ["filesystemService", "stream"],
  },
  {
    id: "filesystemService",
    name: "FilesystemService",
    process: "main",
    description: "Node fs plus one @parcel/watcher subscription.",
    state: [
      { name: "watchState", type: "{ path, subscription } | undefined" },
      { name: "watchEventStream", type: "Stream<FilesystemWatchBatch>" },
    ],
    composes: ["stream"],
  },
  {
    id: "pluginService",
    name: "PluginService",
    process: "main",
    description: "Discovers, builds, and loads workspace plugins.",
    state: [{ name: "loaded", type: "PluginList" }],
    composes: ["workspaceService"],
  },
  {
    id: "toolRuntimeService",
    name: "ToolRuntimeService",
    process: "main",
    description:
      "One Executor runtime per workspace and user; tracks OAuth waits.",
    state: [
      { name: "runtime", type: "ToolRuntime | undefined" },
      { name: "workspaceRoot", type: "string | undefined" },
      { name: "userId", type: "string | undefined" },
      { name: "oauthRedirectUri", type: "string | undefined" },
      { name: "pendingConnections", type: "Map<state, { complete }>" },
    ],
    composes: ["toolRuntime"],
  },
  {
    id: "toolRuntime",
    name: "ToolRuntime",
    process: "main",
    description: "Executor runtime: tool plugins, credential vault, SQLite.",
    state: [
      { name: "credentialVault", type: "CredentialVault" },
      { name: "executor.db", type: "SQLite on disk" },
    ],
    composes: [],
  },
];

const electron = "apps/electron/src";
const server = "packages/server/src";
const shared = "packages/shared/src";

export const haloProgram: Program = {
  name: "Halo",
  services,
  flows: [
    {
      id: "prompt",
      title: "Send a prompt",
      description:
        "The user presses Enter in the composer. The text crosses into the main process, Pi calls the model, and events stream back into the transcript.",
      children: [
        event({
          from: "human",
          to: "renderer",
          name: "types into the composer",
          carrier: "ui",
          detail: "text: string",
          children: [
            frame({
              service: "composer",
              entry: "Composer.submit",
              summary:
                "Trims the draft, clears it, and restores it when the prompt fails.",
              source: {
                path: `${electron}/renderer/main/agent/AgentPane.tsx`,
                start: 119,
                end: 127,
              },
            }),
            frame({
              service: "agentSessionHook",
              entry: "useAgentSession.prompt",
              summary:
                "Needs readySessionId. Calls sessions.prompt, then invalidates the sessions query.",
              source: {
                path: `${electron}/renderer/main/agent/useAgentSession.ts`,
                start: 89,
                end: 118,
              },
            }),
            event({
              from: "renderer",
              to: "main",
              name: "sessions.prompt",
              carrier: "rpc",
              detail: "{ sessionId, text } over MessagePort",
              children: [
                frame({
                  service: "rpcHandler",
                  entry: "RPCHandler.upgrade(port1)",
                  summary:
                    "Dispatches to haloRpcRouter with haloServer.context; logs oRPC errors.",
                  source: {
                    path: `${electron}/main/main.ts`,
                    start: 211,
                    end: 236,
                  },
                }),
                frame({
                  service: "sessionsRouter",
                  entry: "sessionsRouter.prompt",
                  summary: "Opens the session and forwards the text.",
                  source: {
                    path: `${server}/sessions/sessionsRouter.ts`,
                    start: 51,
                    end: 61,
                  },
                  children: [
                    frame({
                      service: "sessionRegistry",
                      entry: "SessionRegistry.open",
                      summary:
                        "Returns the live session, or opens and registers it once, even under concurrent calls.",
                      source: {
                        path: `${server}/sessions/SessionRegistry.ts`,
                        start: 31,
                        end: 42,
                      },
                    }),
                    frame({
                      service: "haloAgentSession",
                      entry: "HaloAgentSession.prompt",
                      summary:
                        "Rejects empty text. piSession.prompt with streamingBehavior: steer.",
                      source: {
                        path: `${server}/agent/HaloAgentSession.ts`,
                        start: 202,
                        end: 214,
                      },
                    }),
                    frame({
                      service: "piAgentSession",
                      entry: "AgentSession.prompt",
                      summary:
                        "Appends the user message and runs the agent loop with Halo's file, bash, and exec tools.",
                    }),
                  ],
                }),
                event({
                  from: "main",
                  to: "inference",
                  name: "POST /v1/messages",
                  carrier: "network",
                  detail: "streamed completion",
                }),
                event({
                  from: "inference",
                  to: "main",
                  name: "streams tokens and tool calls",
                  carrier: "network",
                  detail: "SSE chunks",
                  children: [
                    frame({
                      service: "piAgentSession",
                      entry: "AgentSession (agent loop)",
                      summary:
                        "Emits message_start/update/end and tool events as the model streams.",
                    }),
                    event({
                      from: "main",
                      to: "disk",
                      name: "append .pi/agent/sessions/<id>.jsonl",
                      carrier: "filesystem",
                    }),
                    event({
                      from: "piAgentSession",
                      to: "haloAgentSession",
                      name: "piSession.subscribe → eventStream.append",
                      carrier: "memory",
                      detail: "AgentSessionEvent",
                      children: [
                        frame({
                          service: "haloAgentSession",
                          entry: "HaloAgentSession (constructor subscription)",
                          summary:
                            "Republishes every Pi event on the Halo stream.",
                          source: {
                            path: `${server}/agent/HaloAgentSession.ts`,
                            start: 83,
                            end: 87,
                          },
                        }),
                        frame({
                          service: "stream",
                          entry: "Stream.consume(signal)",
                          summary:
                            "Buffers appended values into the async generator that sessions.events returned.",
                          source: {
                            path: `${server}/Stream.ts`,
                            start: 94,
                            end: 134,
                          },
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            event({
              from: "main",
              to: "renderer",
              name: "sessions.events yields AgentSessionEvent",
              carrier: "rpc",
              detail: "async iterator over MessagePort",
              children: [
                frame({
                  service: "agentSessionHook",
                  entry: "useAgentSession effect: for await",
                  summary: "Applies each event to React state.",
                  source: {
                    path: `${electron}/renderer/main/agent/useAgentSession.ts`,
                    start: 51,
                    end: 87,
                  },
                }),
                frame({
                  service: "sessionState",
                  entry: "applyAgentSessionEvent",
                  summary:
                    "Folds message_start/update/end and agent_start/end into AgentSessionState.",
                  source: {
                    path: `${shared}/AgentSessionState.ts`,
                    start: 58,
                    end: 122,
                  },
                }),
              ],
            }),
          ],
        }),
        event({
          from: "renderer",
          to: "human",
          name: "streams the reply into the transcript",
          carrier: "ui",
        }),
      ],
    },
  ],
};
