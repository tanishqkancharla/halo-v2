import {
  frame,
  hop,
  inbound,
  outbound,
  type Program,
  type Service,
} from "./Program.js";

const services: Service[] = [
  {
    id: "halo",
    name: "Halo",
    process: "app",
    description:
      "The Electron app: a Chromium renderer, a preload bridge, and the Node main process that hosts Pi.",
    state: [],
    composes: [
      "composer",
      "agentSessionHook",
      "sessionState",
      "apiProvider",
      "haloRpcClient",
      "filesystemSection",
      "preload",
      "electronMain",
      "rpcHandler",
      "haloRpcHttp",
      "haloServer",
    ],
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
      path: [
        inbound({
          name: "Enter in the composer",
          carrier: "ui",
          detail: "text: string",
        }),
        frame({
          service: "halo",
          entry: "Halo",
          summary: "Prompts Pi and streams the reply into the transcript.",
          inner: [
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
            hop({
              name: "sessions.prompt",
              carrier: "rpc",
              detail: "{ sessionId, text } over MessagePort",
            }),
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
              inner: [
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
                outbound({
                  name: "POST model provider",
                  carrier: "network",
                  detail: "streamed completion",
                }),
                outbound({
                  name: "append .pi/agent/sessions/<id>.jsonl",
                  carrier: "filesystem",
                }),
              ],
            }),
            hop({
              name: "piSession.subscribe → eventStream.append",
              carrier: "memory",
              detail: "AgentSessionEvent",
            }),
            frame({
              service: "haloAgentSession",
              entry: "HaloAgentSession (constructor subscription)",
              summary: "Republishes every Pi event on the Halo stream.",
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
            hop({
              name: "sessions.events yields AgentSessionEvent",
              carrier: "rpc",
              detail: "async iterator over MessagePort",
            }),
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
            outbound({
              name: "SessionView re-renders the transcript",
              carrier: "ui",
            }),
          ],
        }),
        outbound({ name: "Streaming assistant reply", carrier: "ui" }),
        outbound({ name: "Model provider request", carrier: "network" }),
        outbound({ name: "Session transcript on disk", carrier: "filesystem" }),
      ],
    },
    {
      id: "fileChange",
      title: "A file changes on disk",
      description:
        "Something edits the workspace folder. The watcher batch turns into tree events that reach the sidebar over a long-lived RPC stream.",
      path: [
        inbound({
          name: "@parcel/watcher batch",
          carrier: "filesystem",
          detail: "create | update | delete under the workspace root",
        }),
        frame({
          service: "halo",
          entry: "Halo",
          summary:
            "Maps watcher events to tree events and pushes them to the sidebar.",
          inner: [
            frame({
              service: "filesystemService",
              entry: "FilesystemService.watch (subscription callback)",
              summary: "Turns watcher errors into FilesystemWatchError values.",
              source: {
                path: `${server}/filesystem/FilesystemService.ts`,
                start: 184,
                end: 205,
              },
            }),
            frame({
              service: "filesystemService",
              entry: "FilesystemService.emitWatchEvents",
              summary:
                "stat()s created entries to tag file vs directory; drops entries that already vanished.",
              source: {
                path: `${server}/filesystem/FilesystemService.ts`,
                start: 224,
                end: 248,
              },
            }),
            hop({
              name: "watchEvents.append({ watchedPath, events })",
              carrier: "memory",
            }),
            frame({
              service: "workspaceService",
              entry: "WorkspaceService (watch filter)",
              summary:
                "Keeps batches for the ready workspace root; warns on FilesystemWatchError.",
              source: {
                path: `${server}/workspace/WorkspaceService.ts`,
                start: 163,
                end: 178,
              },
            }),
            frame({
              service: "workspaceService",
              entry: "WorkspaceService.handleWatchEvents",
              source: {
                path: `${server}/workspace/WorkspaceService.ts`,
                start: 340,
                end: 350,
              },
              inner: [
                frame({
                  service: "workspaceService",
                  entry: "mapFilesystemEventsToTreeEvents",
                  summary:
                    "Skips update events and hidden paths. Tracks directoryPaths so a deleted folder removes its children.",
                  source: {
                    path: `${server}/workspace/WorkspaceService.ts`,
                    start: 85,
                    end: 124,
                  },
                }),
              ],
            }),
            hop({
              name: "treeEvents.append(WorkspaceTreeEvent[])",
              carrier: "memory",
            }),
            frame({
              service: "workspaceRouter",
              entry: "workspaceRouter.events",
              summary: "Returns treeEvents.consume(signal).",
              source: {
                path: `${server}/workspace/workspaceRouter.ts`,
                start: 51,
                end: 54,
              },
            }),
            frame({
              service: "stream",
              entry: "Stream.consume(signal)",
              source: {
                path: `${server}/Stream.ts`,
                start: 94,
                end: 134,
              },
            }),
            hop({
              name: "workspace.events yields WorkspaceTreeEvent[]",
              carrier: "rpc",
              detail: "async iterator over MessagePort",
            }),
            frame({
              service: "filesystemSection",
              entry: "listenWorkspaceTree",
              source: {
                path: `${electron}/renderer/sidebar/FilesystemSection.tsx`,
                start: 136,
                end: 143,
              },
            }),
            frame({
              service: "filesystemSection",
              entry: "applyPathEvents → queryClient.setQueryData",
              summary:
                "Adds created paths; removes deleted paths and their descendants.",
              source: {
                path: `${electron}/renderer/sidebar/FilesystemSection.tsx`,
                start: 42,
                end: 60,
              },
            }),
            frame({
              service: "apiProvider",
              entry: "workspace-paths query",
              summary: "The cache entry the file tree renders from.",
              source: {
                path: `${electron}/renderer/api/ApiProvider.tsx`,
                start: 131,
                end: 147,
              },
            }),
            outbound({ name: "Files section re-renders", carrier: "ui" }),
          ],
        }),
        outbound({ name: "Sidebar file tree updates", carrier: "ui" }),
      ],
    },
    {
      id: "launch",
      title: "App launch",
      description:
        "Electron finishes booting. Halo restores the saved workspace, opens its RPC transports, opens the window, and the renderer connects back.",
      path: [
        inbound({ name: "Electron app.whenReady", carrier: "process" }),
        frame({
          service: "halo",
          entry: "Halo",
          summary:
            "Restores the workspace, opens RPC transports, opens the window, connects the renderer.",
          inner: [
            frame({
              service: "electronMain",
              entry: "app.whenReady handler",
              summary:
                "start server → IPC bridges → loopback HTTP → menu → window → updates.",
              source: {
                path: `${electron}/main/main.ts`,
                start: 100,
                end: 130,
              },
            }),
            frame({
              service: "haloServer",
              entry: "HaloServer.start",
              source: {
                path: `${server}/HaloServer.ts`,
                start: 98,
                end: 105,
              },
              inner: [
                frame({
                  service: "workspaceService",
                  entry: "WorkspaceService.restore",
                  summary:
                    "Reads the saved preference and re-selects it; clears the preference when the folder is gone.",
                  source: {
                    path: `${server}/workspace/WorkspaceService.ts`,
                    start: 245,
                    end: 270,
                  },
                  inner: [
                    inbound({
                      name: "read <userData>/workspace.json",
                      carrier: "filesystem",
                    }),
                    frame({
                      service: "workspaceService",
                      entry: "readWorkspacePreference",
                      summary:
                        "Parses JSON and checks the schema; deletes a bad file.",
                      source: {
                        path: `${server}/workspace/WorkspaceService.ts`,
                        start: 421,
                        end: 455,
                      },
                    }),
                    frame({
                      service: "workspaceService",
                      entry: "WorkspaceService.select",
                      summary:
                        "realpath + stat, then sets up the folder and starts watching it.",
                      source: {
                        path: `${server}/workspace/WorkspaceService.ts`,
                        start: 272,
                        end: 334,
                      },
                      inner: [
                        outbound({
                          name: "mkdir .pi/agent/sessions",
                          carrier: "filesystem",
                        }),
                        frame({
                          service: "pluginService",
                          entry: "seedPluginWorkspace",
                          summary:
                            "Writes the halo-plugin and maui skills when missing (always in dev).",
                          source: {
                            path: `${server}/plugins/seedPluginWorkspace.ts`,
                            start: 16,
                            end: 56,
                          },
                        }),
                        outbound({
                          name: "write .pi/agent/skills/*/SKILL.md",
                          carrier: "filesystem",
                        }),
                        frame({
                          service: "workspaceService",
                          entry: "installHaloCli",
                          summary:
                            "Writes <workspace>/.halo/bin/halo and prepends it to PATH.",
                          source: {
                            path: `${server}/workspace/installHaloCli.ts`,
                            start: 82,
                            end: 131,
                          },
                        }),
                        outbound({
                          name: "write .halo/bin/halo",
                          carrier: "filesystem",
                        }),
                        frame({
                          service: "workspaceService",
                          entry: "writeWorkspacePreference",
                          source: {
                            path: `${server}/workspace/WorkspaceService.ts`,
                            start: 457,
                            end: 475,
                          },
                        }),
                        outbound({
                          name: "write <userData>/workspace.json",
                          carrier: "filesystem",
                        }),
                        frame({
                          service: "filesystemService",
                          entry: "FilesystemService.watch",
                          summary: "Subscribes @parcel/watcher to the root.",
                          source: {
                            path: `${server}/filesystem/FilesystemService.ts`,
                            start: 184,
                            end: 205,
                          },
                        }),
                      ],
                    }),
                  ],
                }),
                frame({
                  service: "pluginService",
                  entry: "PluginService.list",
                  summary:
                    "Loads workspace plugins so the first render has them.",
                  source: {
                    path: `${server}/plugins/PluginService.ts`,
                    start: 186,
                    end: 241,
                  },
                }),
              ],
            }),
            frame({
              service: "electronMain",
              entry: "registerLogBridge / registerRpcBridge",
              summary:
                "ipcMain listeners for renderer logs and for RPC port requests.",
              source: {
                path: `${electron}/main/main.ts`,
                start: 194,
                end: 236,
              },
            }),
            frame({
              service: "haloRpcHttp",
              entry: "listenHaloRpcHttp",
              summary:
                "Loopback HTTP on a random port with a bearer token for the halo CLI.",
              source: {
                path: `${electron}/main/HaloRpcHttp.ts`,
                start: 30,
                end: 99,
              },
            }),
            outbound({
              name: "write <userData>/rpc.json",
              carrier: "filesystem",
              detail: "{ host, port, token } mode 0600",
            }),
            frame({
              service: "electronMain",
              entry: "openMainWindow → createWindow",
              summary: "Sandboxed BrowserWindow with the preload script.",
              source: {
                path: `${electron}/main/main.ts`,
                start: 158,
                end: 192,
              },
            }),
            hop({
              name: "BrowserWindow.loadURL",
              carrier: "process",
              detail: "renderer boots main.tsx",
            }),
            frame({
              service: "apiProvider",
              entry: "ApiProvider → ResolveApi",
              summary: "Runs createElectronApi as the first query.",
              source: {
                path: `${electron}/renderer/api/ApiProvider.tsx`,
                start: 70,
                end: 91,
              },
            }),
            frame({
              service: "haloRpcClient",
              entry: "connectHaloRpc → requestRpcPort",
              summary: "Asks the preload for a MessagePort.",
              source: {
                path: `${electron}/renderer/api/HaloRpcClient.ts`,
                start: 6,
                end: 25,
              },
            }),
            hop({
              name: "window.postMessage(halo:request-rpc)",
              carrier: "ipc",
            }),
            frame({
              service: "preload",
              entry: "window message listener",
              summary: "Forwards the request with ipcRenderer.postMessage.",
              source: {
                path: `${electron}/main/preload.ts`,
                start: 26,
                end: 38,
              },
            }),
            hop({ name: "ipcMain halo:request-rpc", carrier: "ipc" }),
            frame({
              service: "electronMain",
              entry: "registerRpcBridge handler",
              summary:
                "Checks the sender window. New MessageChannelMain; RPCHandler.upgrade(port1); posts port2 to the frame.",
              source: {
                path: `${electron}/main/main.ts`,
                start: 211,
                end: 236,
              },
            }),
            hop({
              name: "frame.postMessage(halo:provide-rpc, [port2])",
              carrier: "ipc",
            }),
            frame({
              service: "preload",
              entry: "ipcRenderer.on(halo:provide-rpc)",
              summary:
                "Waits for window load, then hands the port to the page.",
              source: {
                path: `${electron}/main/preload.ts`,
                start: 40,
                end: 45,
              },
            }),
            hop({
              name: "window.postMessage(halo:provide-rpc, ports)",
              carrier: "ipc",
            }),
            frame({
              service: "haloRpcClient",
              entry: "createORPCClient(new RPCLink({ port }))",
              source: {
                path: `${electron}/renderer/api/HaloRpcClient.ts`,
                start: 6,
                end: 12,
              },
            }),
            frame({
              service: "apiProvider",
              entry: "restoreWorkspace",
              summary:
                "workspace.get, then workspace.choose when nothing is saved.",
              source: {
                path: `${electron}/renderer/api/ApiProvider.tsx`,
                start: 228,
                end: 246,
              },
            }),
            hop({ name: "workspace.get", carrier: "rpc" }),
            frame({
              service: "workspaceRouter",
              entry: "workspaceRouter.get",
              source: {
                path: `${server}/workspace/workspaceRouter.ts`,
                start: 17,
                end: 20,
              },
            }),
            outbound({
              name: "WorkspaceShell renders the sidebar and main pane",
              carrier: "ui",
            }),
          ],
        }),
        outbound({ name: "Main window", carrier: "ui" }),
        outbound({
          name: "rpc.json, workspace.json, .halo/bin/halo",
          carrier: "filesystem",
        }),
      ],
    },
    {
      id: "oauthCallback",
      title: "OAuth callback arrives",
      description:
        "The browser redirects to Halo's loopback HTTP after the user approves an integration. The waiting connection resolves and Pi is told to continue.",
      path: [
        inbound({
          name: "GET /oauth/callback",
          carrier: "http",
          detail: "?state&code from the provider",
        }),
        frame({
          service: "halo",
          entry: "Halo",
          summary:
            "Completes the OAuth exchange, resolves the waiting connection, and nudges the agent.",
          inner: [
            frame({
              service: "haloRpcHttp",
              entry: "handleRpcRequest",
              summary:
                "Routes /oauth/callback before the bearer-token check that guards /rpc.",
              source: {
                path: `${electron}/main/HaloRpcHttp.ts`,
                start: 101,
                end: 145,
              },
            }),
            frame({
              service: "haloRpcHttp",
              entry: "handleOAuthCallback",
              summary:
                "GET only. A provider error cancels the flow; otherwise completes it.",
              source: {
                path: `${electron}/main/HaloRpcHttp.ts`,
                start: 147,
                end: 202,
              },
            }),
            frame({
              service: "toolRuntimeService",
              entry: "ToolRuntimeService.completeOAuth",
              summary:
                "Exchanges the code, then resolves the pendingConnections entry for this state.",
              source: {
                path: `${server}/agent/runtime/ToolRuntimeService.ts`,
                start: 128,
                end: 142,
              },
              inner: [
                frame({
                  service: "toolRuntime",
                  entry: "ToolRuntime.completeOAuth",
                  source: {
                    path: `${server}/agent/runtime/ToolRuntime.ts`,
                    start: 485,
                    end: 495,
                  },
                }),
                outbound({
                  name: "POST provider token endpoint",
                  carrier: "network",
                }),
                outbound({
                  name: "store credential in the vault",
                  carrier: "filesystem",
                }),
              ],
            }),
            outbound({
              name: "200 You can close this tab.",
              carrier: "http",
            }),
            hop({
              name: "pending.complete(undefined)",
              carrier: "memory",
              detail: "resolves the promise startConnection awaits",
            }),
            frame({
              service: "sessionsRouter",
              entry: "sessionsRouter.startConnection (resumes)",
              summary:
                "Was awaiting toolRuntime.startConnection; now notifies the session.",
              source: {
                path: `${server}/sessions/sessionsRouter.ts`,
                start: 63,
                end: 77,
              },
            }),
            frame({
              service: "haloAgentSession",
              entry: "HaloAgentSession.notify",
              summary:
                "sendCustomMessage halo.integration.connected with triggerTurn.",
              source: {
                path: `${server}/agent/HaloAgentSession.ts`,
                start: 227,
                end: 239,
              },
            }),
            frame({
              service: "piAgentSession",
              entry: "AgentSession.sendCustomMessage",
              summary: "Starts a new turn so the agent retries the tool call.",
            }),
            outbound({ name: "POST model provider", carrier: "network" }),
          ],
        }),
        outbound({ name: "200 to the browser tab", carrier: "http" }),
        outbound({ name: "Agent continues the turn", carrier: "network" }),
      ],
    },
  ],
};
