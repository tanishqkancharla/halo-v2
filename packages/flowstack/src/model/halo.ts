import {
  generatedPromptFlow,
  generatedPromptServices,
} from "./generated/prompt.js";
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
    description: "The Codex responses API at chatgpt.com/backend-api.",
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
      "editor",
      "composer",
      "sessionView",
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
    description:
      "pi-coding-agent: owns the Agent, queues steering input, persists messages.",
    state: [
      { name: "isStreaming", type: "boolean" },
      { name: "steeringQueue", type: "string[]" },
    ],
    composes: ["piAgent", "sessionManager"],
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
  {
    id: "shell",
    name: "Shell",
    process: "outside",
    description: "A child shell the bash tool spawns in the workspace.",
    state: [],
    composes: [],
  },
  {
    id: "editor",
    name: "Editor",
    process: "renderer",
    description: "TipTap editor inside the composer; Cmd/Ctrl+Enter submits.",
    state: [],
    composes: [],
  },
  {
    id: "sessionView",
    name: "SessionView",
    process: "renderer",
    description:
      "Turns AgentSessionState into transcript rows: user bubbles, tool activity, streamed markdown.",
    state: [],
    composes: [],
  },
  {
    id: "piAgent",
    name: "Pi Agent",
    process: "main",
    description:
      "pi-agent-core: the agent loop that calls the model, runs tools, and emits AgentEvents.",
    state: [
      { name: "messages", type: "AgentMessage[]" },
      { name: "streamingMessage", type: "AssistantMessage | undefined" },
      { name: "pendingToolCalls", type: "Set<string>" },
    ],
    composes: ["modelRuntime", "codingTools"],
  },
  {
    id: "modelRuntime",
    name: "ModelRuntime",
    process: "main",
    description:
      "Resolves the model and its auth, then delegates to the provider.",
    state: [{ name: "models.json", type: "model catalog on disk" }],
    composes: ["codexProvider"],
  },
  {
    id: "codexProvider",
    name: "openai-codex-responses",
    process: "main",
    description:
      "pi-ai provider: POSTs to the Codex responses API and parses the SSE stream.",
    state: [],
    composes: [],
  },
  {
    id: "sessionManager",
    name: "Pi SessionManager",
    process: "main",
    description: "The session transcript as a jsonl tree on disk.",
    state: [
      { name: "byId", type: "Map<string, SessionEntry>" },
      { name: "leafId", type: "string" },
    ],
    composes: [],
  },
  {
    id: "codingTools",
    name: "coding tools",
    process: "main",
    description:
      "read, edit, write, patch, bash, and exec, each behind ToolRuntime.authorize.",
    state: [],
    composes: ["filesystemService", "toolRuntime"],
  },
];

const electron = "apps/electron/src";
const server = "packages/server/src";
const shared = "packages/shared/src";
const pi = "node_modules/@earendil-works";

export const haloProgram: Program = {
  name: "Halo",
  services: [...services, ...generatedPromptServices],
  flows: [
    generatedPromptFlow,
    {
      id: "prompt",
      title: "Send a prompt",
      description:
        "The user presses Cmd/Ctrl+Enter. The text crosses into the main process over one RPC, Pi starts the agent run, and the call resolves when the run ends. The run itself is the next flow.",
      children: [
        event({
          from: "human",
          to: "renderer",
          name: "Cmd/Ctrl+Enter in the composer",
          carrier: "ui",
          detail: "plain Enter is a newline",
          children: [
            frame({
              service: "editor",
              entry: "Editor.handleKeyDown",
              summary: "Enter with meta or ctrl calls onSubmit.",
              source: {
                path: `${electron}/renderer/main/agent/Editor.tsx`,
                start: 93,
                end: 100,
              },
              children: [
                frame({
                  service: "composer",
                  entry: "Composer.submit",
                  at: 96,
                  summary:
                    "Trims the draft, clears it, and restores it when the prompt fails.",
                  source: {
                    path: `${electron}/renderer/main/agent/AgentPane.tsx`,
                    start: 119,
                    end: 126,
                  },
                  children: [
                    frame({
                      service: "agentSessionHook",
                      entry: "useAgentSession.prompt",
                      at: 123,
                      summary:
                        "Needs readySessionId. Calls sessions.prompt and waits for the whole agent run; the reply streams in through the sessions.events subscription that the mount effect opened.",
                      source: {
                        path: `${electron}/renderer/main/agent/useAgentSession.ts`,
                        start: 89,
                        end: 118,
                      },
                      children: [
                        event({
                          from: "renderer",
                          to: "main",
                          name: "sessions.prompt",
                          at: 97,
                          carrier: "rpc",
                          detail:
                            "{ sessionId, text } over the MessagePort; resolves when the agent run ends",
                          children: [promptHandling()],
                        }),
                        frame({
                          service: "agentSessionHook",
                          entry: "queryClient.invalidateQueries(['sessions'])",
                          at: 114,
                          summary:
                            "Runs once sessions.prompt resolves, after agent_end. Refetches every sessions query so the sidebar picks up the new title.",
                          source: {
                            path: `${electron}/renderer/main/agent/useAgentSession.ts`,
                            start: 114,
                            end: 117,
                          },
                          children: [
                            frame({
                              service: "apiProvider",
                              entry: "useSessionsQuery",
                              at: 114,
                              summary:
                                "TanStack Query reruns queryFn, then the sidebar re-renders with the result.",
                              source: {
                                path: `${electron}/renderer/api/ApiProvider.tsx`,
                                start: 117,
                                end: 128,
                              },
                              children: [
                                event({
                                  from: "renderer",
                                  to: "main",
                                  name: "sessions.list",
                                  carrier: "rpc",
                                  at: 126,
                                  children: [
                                    frame({
                                      service: "sessionsRouter",
                                      entry: "sessionsRouter.list",
                                      at: 126,
                                      source: {
                                        path: `${server}/sessions/sessionsRouter.ts`,
                                        start: 18,
                                        end: 22,
                                      },
                                      children: [
                                        frame({
                                          service: "haloAgentSession",
                                          entry: "HaloAgentSession.list",
                                          at: 20,
                                          summary:
                                            "SessionManager.list over the session dir; title from the name or first message.",
                                          source: {
                                            path: `${server}/agent/HaloAgentSession.ts`,
                                            start: 126,
                                            end: 136,
                                          },
                                          children: [
                                            event({
                                              from: "main",
                                              to: "disk",
                                              name: "scan .pi/agent/sessions/*.jsonl",
                                              carrier: "filesystem",
                                              at: 129,
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
                                  name: "SessionSummary[]",
                                  carrier: "rpc",
                                  at: 126,
                                  detail: "useQuery re-renders the sidebar",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    },
    {
      id: "agentRun",
      title: "Agent run (work in progress)",
      description:
        "What AgentSession.prompt starts: Pi's agent loop calls the model and its tools, and every AgentEvent streams back through the sessions.events subscription into the transcript.",
      children: [
        event({
          from: "piAgentSession",
          to: "piAgent",
          name: "AgentSession._runAgentPrompt",
          carrier: "memory",
          detail: "the run sessions.prompt is waiting on",
          children: [
            frame({
              service: "piAgentSession",
              entry: "AgentSession._runAgentPrompt",
              summary:
                "agent.prompt, then agent.continue while retries, compaction, or queued input remain.",
              source: {
                path: `${pi}/pi-coding-agent/dist/core/agent-session.js`,
                start: 744,
                end: 756,
              },
              children: [
                frame({
                  service: "piAgent",
                  entry: "Agent.prompt",
                  source: {
                    path: `${pi}/pi-agent-core/dist/agent.js`,
                    start: 221,
                    end: 267,
                  },
                  children: [
                    frame({
                      service: "piAgent",
                      entry: "runAgentLoop",
                      summary:
                        "Emits agent_start and turn_start, then the user message_start/message_end, then runs turns until the model stops asking for tools.",
                      source: {
                        path: `${pi}/pi-agent-core/dist/agent-loop.js`,
                        start: 43,
                        end: 56,
                      },
                      children: [
                        agentEventFanout(
                          "agent_start, turn_start, user message_start/message_end",
                        ),
                        frame({
                          service: "piAgent",
                          entry: "runLoop",
                          summary:
                            "One turn: stream the assistant reply, run its tool calls, repeat.",
                          source: {
                            path: `${pi}/pi-agent-core/dist/agent-loop.js`,
                            start: 78,
                            end: 172,
                          },
                          children: [
                            frame({
                              service: "piAgent",
                              entry: "streamAssistantResponse",
                              summary:
                                "convertToLlm, then streamFn(model, context). Maps provider deltas to message_start/update/end.",
                              source: {
                                path: `${pi}/pi-agent-core/dist/agent-loop.js`,
                                start: 178,
                                end: 254,
                              },
                              children: [
                                frame({
                                  service: "modelRuntime",
                                  entry: "ModelRuntime.streamSimple",
                                  summary:
                                    "Prepares model and auth, hands off to the provider.",
                                  source: {
                                    path: `${pi}/pi-coding-agent/dist/core/model-runtime.js`,
                                    start: 343,
                                    end: 347,
                                  },
                                  children: [
                                    frame({
                                      service: "codexProvider",
                                      entry: "openai-codex-responses.stream",
                                      summary:
                                        "Builds the request, retries on transient errors, prefers WebSocket, falls back to SSE.",
                                      source: {
                                        path: `${pi}/pi-ai/dist/api/openai-codex-responses.js`,
                                        start: 262,
                                        end: 285,
                                      },
                                      children: [
                                        event({
                                          from: "main",
                                          to: "inference",
                                          name: "POST /codex/responses",
                                          carrier: "network",
                                          detail:
                                            "Bearer OAuth token, accept: text/event-stream",
                                        }),
                                        event({
                                          from: "inference",
                                          to: "main",
                                          name: "SSE response deltas",
                                          carrier: "network",
                                          detail:
                                            "text and tool-call deltas until done",
                                          children: [
                                            frame({
                                              service: "codexProvider",
                                              entry: "processResponsesStream",
                                              summary:
                                                "Parses each SSE event into AssistantMessageEvents.",
                                            }),
                                            agentEventFanout(
                                              "assistant message_start, message_update per delta, message_end",
                                            ),
                                          ],
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            frame({
                              service: "piAgent",
                              entry: "executeToolCalls",
                              summary:
                                "Only when the assistant message has toolCall parts. Runs each tool, emits tool_execution_start/update/end, appends a toolResult message, then the next turn calls the model again.",
                              source: {
                                path: `${pi}/pi-agent-core/dist/agent-loop.js`,
                                start: 287,
                                end: 293,
                              },
                              children: [
                                frame({
                                  service: "codingTools",
                                  entry: "withAuthority(tool).execute",
                                  summary:
                                    "ToolRuntime.authorize against the static workspace authority, then the tool.",
                                  source: {
                                    path: `${server}/agent/tools/codingTools.ts`,
                                    start: 81,
                                    end: 92,
                                  },
                                  children: [
                                    frame({
                                      service: "filesystemService",
                                      entry:
                                        "FilesystemService.readFile / writeFile",
                                      summary:
                                        "read, edit, write, and patch go through here.",
                                      source: {
                                        path: `${server}/filesystem/FilesystemService.ts`,
                                        start: 94,
                                        end: 101,
                                      },
                                      children: [
                                        event({
                                          from: "main",
                                          to: "disk",
                                          name: "read or write workspace files",
                                          carrier: "filesystem",
                                          children: [fileWatchFanout()],
                                        }),
                                      ],
                                    }),
                                    event({
                                      from: "main",
                                      to: "shell",
                                      name: "bash: spawn a shell in the workspace",
                                      carrier: "process",
                                      detail: "Pi createBashTool(cwd)",
                                    }),
                                    frame({
                                      service: "toolRuntime",
                                      entry: "ToolRuntime.executeCode",
                                      summary:
                                        "exec: runs the model's code in the QuickJS Executor with the workspace plugins.",
                                      source: {
                                        path: `${server}/agent/runtime/ToolRuntime.ts`,
                                        start: 360,
                                        end: 393,
                                      },
                                    }),
                                  ],
                                }),
                                agentEventFanout(
                                  "tool_execution_start/update/end, toolResult message_start/message_end",
                                ),
                              ],
                            }),
                            agentEventFanout(
                              "turn_end; agent_end after the last turn",
                            ),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    },
  ],
};

function promptHandling() {
  return frame({
    service: "rpcHandler",
    entry: "RPCHandler.upgrade(port1)",
    summary:
      "Dispatches to haloRpcRouter with haloServer.context; logs oRPC errors.",
    source: { path: `${electron}/main/main.ts`, start: 211, end: 235 },
    children: [
      frame({
        service: "sessionsRouter",
        entry: "sessionsRouter.prompt",
        at: 230,
        summary:
          "Logs { event: 'prompt', sessionId, textLength }, opens the session, forwards the text.",
        source: {
          path: `${server}/sessions/sessionsRouter.ts`,
          start: 51,
          end: 60,
        },
        children: [
          frame({
            service: "sessionRegistry",
            entry: "SessionRegistry.open",
            at: 57,
            summary:
              "Returns the live session. The events subscription already opened it, so no disk read here.",
            source: {
              path: `${server}/sessions/SessionRegistry.ts`,
              start: 31,
              end: 41,
            },
          }),
          frame({
            service: "haloAgentSession",
            entry: "HaloAgentSession.prompt",
            at: 59,
            summary:
              "Rejects empty text. piSession.prompt with streamingBehavior: steer.",
            source: {
              path: `${server}/agent/HaloAgentSession.ts`,
              start: 202,
              end: 214,
            },
            children: [
              frame({
                service: "piAgentSession",
                entry: "AgentSession.prompt",
                at: 205,
                summary:
                  "Expands templates, checks the model's auth, builds the user message, and starts the agent run. The run and its event stream are the next flow.",
                source: {
                  path: `${pi}/pi-coding-agent/dist/core/agent-session.js`,
                  start: 792,
                  end: 916,
                },
                children: [],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Every AgentEvent takes this path from the Pi agent to the transcript. */
function agentEventFanout(which: string) {
  return event({
    from: "piAgent",
    to: "piAgentSession",
    name: "AgentEvent",
    carrier: "memory",
    detail: which,
    children: [
      frame({
        service: "piAgentSession",
        entry: "AgentSession._handleAgentEvent",
        summary:
          "Runs extension hooks, emits to subscribers, and persists durable messages.",
        source: {
          path: `${pi}/pi-coding-agent/dist/core/agent-session.js`,
          start: 327,
          end: 386,
        },
        children: [
          frame({
            service: "sessionManager",
            entry: "SessionManager.appendMessage",
            summary:
              "On message_end for user, assistant, and toolResult messages.",
            source: {
              path: `${pi}/pi-coding-agent/dist/core/session-manager.js`,
              start: 766,
              end: 775,
            },
            children: [
              event({
                from: "main",
                to: "disk",
                name: "append .pi/agent/sessions/<timestamp>_<id>.jsonl",
                carrier: "filesystem",
              }),
            ],
          }),
          event({
            from: "piAgentSession",
            to: "haloAgentSession",
            name: "piSession.subscribe callback",
            carrier: "memory",
            detail: "AgentSessionEvent",
            children: [
              frame({
                service: "haloAgentSession",
                entry: "HaloAgentSession (constructor subscription)",
                summary: "eventStream.append(event)",
                source: {
                  path: `${server}/agent/HaloAgentSession.ts`,
                  start: 83,
                  end: 86,
                },
                children: [
                  frame({
                    service: "stream",
                    entry: "Stream.consume(signal)",
                    summary:
                      "Buffers appended values into the async generator that sessions.events returned when the pane mounted.",
                    source: {
                      path: `${server}/Stream.ts`,
                      start: 94,
                      end: 133,
                    },
                    children: [
                      event({
                        from: "main",
                        to: "renderer",
                        name: "AgentSessionEvent",
                        carrier: "rpc",
                        detail:
                          "sessions.events async iterator over the MessagePort",
                        children: [
                          frame({
                            service: "agentSessionHook",
                            entry: "useAgentSession effect: for await",
                            summary:
                              "setState(applyAgentSessionEvent(current, event))",
                            source: {
                              path: `${electron}/renderer/main/agent/useAgentSession.ts`,
                              start: 51,
                              end: 87,
                            },
                            children: [
                              frame({
                                service: "sessionState",
                                entry: "applyAgentSessionEvent",
                                summary:
                                  "message_start/update/end fold into messages and streamingMessage; agent_start/end flip isWorking. tool_execution_* and turn_* are ignored.",
                                source: {
                                  path: `${shared}/AgentSessionState.ts`,
                                  start: 58,
                                  end: 121,
                                },
                                children: [
                                  frame({
                                    service: "sessionView",
                                    entry: "SessionView → sessionViewItems",
                                    summary:
                                      "Rebuilds the transcript rows and scrolls to the bottom.",
                                    source: {
                                      path: `${electron}/renderer/main/agent/AgentPane.tsx`,
                                      start: 164,
                                      end: 201,
                                    },
                                    children: [
                                      frame({
                                        service: "sessionView",
                                        entry: "AssistantMessage",
                                        summary:
                                          "Streamdown markdown, animating while part.streaming.",
                                        source: {
                                          path: `${electron}/renderer/main/agent/AssistantMessage.tsx`,
                                          start: 144,
                                          end: 160,
                                        },
                                        children: [
                                          event({
                                            from: "renderer",
                                            to: "human",
                                            name: "transcript repaints",
                                            carrier: "ui",
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A tool's file write comes back to the sidebar through the watcher. */
function fileWatchFanout() {
  return frame({
    service: "filesystemService",
    entry: "@parcel/watcher subscription → emitWatchEvents",
    summary: "watchEventStream.append(batch) for the workspace root.",
    source: {
      path: `${server}/filesystem/FilesystemService.ts`,
      start: 224,
      end: 246,
    },
    children: [
      frame({
        service: "workspaceService",
        entry: "WorkspaceService.handleWatchEvents",
        summary:
          "mapFilesystemEventsToTreeEvents, then treeEventStream.append.",
        source: {
          path: `${server}/workspace/WorkspaceService.ts`,
          start: 340,
          end: 349,
        },
        children: [
          event({
            from: "main",
            to: "renderer",
            name: "WorkspaceTreeEvent[]",
            carrier: "rpc",
            detail: "workspace.events async iterator",
            children: [
              frame({
                service: "filesystemSection",
                entry: "listenWorkspaceTree → setQueryData(workspace-paths)",
                summary:
                  "The sidebar tree updates without a full listPaths refetch.",
                source: {
                  path: `${electron}/renderer/sidebar/FilesystemSection.tsx`,
                  start: 136,
                  end: 143,
                },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
