import type {
  AgentSession,
  AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import { dialog, type BrowserWindow } from "electron";
import {
  AgentSessionApi,
  HaloApi,
  type PromptEventHandler,
  type PromptStreamEvent,
  type WorkspaceInfo,
} from "../shared/rpc.js";
import { toolCallFromPi } from "../shared/ToolCall.js";
import { EmptyPromptError, PromptFailedError } from "./agent-session-errors.js";
import type { PiService } from "./pi-service.js";
import type { WorkspaceService } from "./workspace-service.js";

export class HaloRpc extends HaloApi {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly pi: PiService,
    private readonly getWindow: () => BrowserWindow,
  ) {
    super();
  }

  getWorkspace(): WorkspaceInfo | null {
    return this.workspace.getWorkspace();
  }

  async chooseWorkspace() {
    const selection = await dialog.showOpenDialog(this.getWindow(), {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return null;
    const workspace = await this.workspace.select(selection.filePaths[0]!);
    if (workspace instanceof Error) throw workspace;
    return workspace;
  }

  async listSessions() {
    const sessions = await this.pi.listSessions();
    if (sessions instanceof Error) throw sessions;
    return sessions;
  }

  async readSessionTranscript(sessionId: string) {
    const transcript = await this.pi.readTranscript(sessionId);
    if (transcript instanceof Error) throw transcript;
    return transcript;
  }

  async newAgentSession() {
    const session = await this.pi.newAgentSession();
    if (session instanceof Error) throw session;
    return new AgentSessionRpc(session);
  }

  async openAgentSession(sessionId: string) {
    const session = await this.pi.openAgentSession(sessionId);
    if (session instanceof Error) throw session;
    return new AgentSessionRpc(session);
  }
}

type PromptListener = PromptEventHandler & {
  dup?: () => PromptEventHandler & Disposable;
} & Partial<Disposable>;

/** Cap'n Web stub wrapping a live Pi AgentSession. */
export class AgentSessionRpc extends AgentSessionApi {
  private listener: PromptListener | null = null;
  private deliveries = Promise.resolve();
  private readonly unsubscribePi: () => void;

  constructor(private readonly session: AgentSession) {
    super();
    this.unsubscribePi = session.subscribe((event) => {
      const streamEvent = promptStreamEvent(this.session.sessionId, event);
      if (streamEvent === null) return;
      const listener = this.listener;
      if (listener === null) return;
      this.deliveries = this.deliveries.then(() => listener(streamEvent));
    });
  }

  getSessionId() {
    return this.session.sessionId;
  }

  subscribe(callback: PromptListener) {
    // Cap'n Web releases arg stubs when the call returns unless we dup().
    this.listener =
      typeof callback.dup === "function" ? callback.dup() : callback;
  }

  async prompt(text: string) {
    if (text.trim().length === 0) throw new EmptyPromptError();
    const prompted = await this.session
      .prompt(text)
      .catch((e) => new PromptFailedError({ cause: e }));
    if (prompted instanceof Error) throw prompted;
    await this.deliveries;
  }

  [Symbol.dispose]() {
    this.unsubscribePi();
    const listener = this.listener;
    if (listener !== null) {
      const dispose = listener[Symbol.dispose];
      if (typeof dispose === "function") dispose.call(listener);
    }
    this.listener = null;
    void this.session.abort().catch((error) => {
      console.warn("Failed to abort disposed agent session:", error);
    });
    this.session.dispose();
  }
}

function promptStreamEvent(
  sessionId: string,
  event: AgentSessionEvent,
): PromptStreamEvent | null {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    return {
      type: "delta",
      sessionId,
      text: event.assistantMessageEvent.delta,
    };
  }
  if (event.type === "tool_execution_start") {
    const toolCall = toolCallFromPi(
      event.toolCallId,
      event.toolName,
      event.args,
    );
    if (toolCall === null) return null;
    return { type: "toolCall", sessionId, toolCall };
  }
  return null;
}
