import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { RpcTarget } from "capnweb";
import { dialog, type BrowserWindow } from "electron";
import type {
  PromptEventHandler,
  WorkspaceInfo,
} from "../renderer/api/SystemApi.js";
import { EmptyPromptError, PromptFailedError } from "./agent-session-errors.js";
import type { CreateAgentSessionOptions, PiService } from "./pi-service.js";
import type { WorkspaceService } from "./workspace-service.js";

export class HaloRpc extends RpcTarget {
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
    return this.workspace.select(selection.filePaths[0]!);
  }

  listSessions() {
    return this.pi.listSessions();
  }

  readSessionTranscript(sessionId: string) {
    return this.pi.readTranscript(sessionId);
  }

  async createAgentSession(options: CreateAgentSessionOptions = {}) {
    const session = await this.pi.createAgentSession(options);
    if (session instanceof Error) return session;
    return {
      sessionId: session.sessionId,
      session: new AgentSessionRpc(session),
    };
  }
}

type PromptListener = PromptEventHandler & {
  dup?: () => PromptEventHandler & Disposable;
} & Partial<Disposable>;

/** Cap'n Web stub wrapping a live Pi AgentSession. */
export class AgentSessionRpc extends RpcTarget {
  private listeners = new Set<PromptListener>();
  private pendingDeliveries: Promise<unknown>[] | null = null;
  private readonly unsubscribePi: () => void;

  constructor(private readonly session: AgentSession) {
    super();
    this.unsubscribePi = session.subscribe((event) => {
      if (
        event.type !== "message_update" ||
        event.assistantMessageEvent.type !== "text_delta"
      ) {
        return;
      }
      const streamEvent = {
        type: "delta" as const,
        sessionId: this.session.sessionId,
        text: event.assistantMessageEvent.delta,
      };
      for (const listener of this.listeners) {
        const delivery = Promise.resolve(listener(streamEvent));
        if (this.pendingDeliveries !== null) {
          this.pendingDeliveries.push(delivery);
        }
      }
    });
  }

  subscribe(callback: PromptListener) {
    // Cap'n Web releases arg stubs when the call returns unless we dup().
    const retained =
      typeof callback.dup === "function" ? callback.dup() : callback;
    this.listeners.add(retained);
    return () => {
      this.listeners.delete(retained);
      const dispose = retained[Symbol.dispose];
      if (typeof dispose === "function") dispose.call(retained);
    };
  }

  async prompt(text: string) {
    if (text.trim().length === 0) return new EmptyPromptError();
    this.pendingDeliveries = [];
    const prompted = await this.session
      .prompt(text)
      .catch((e) => new PromptFailedError({ cause: e }));
    await Promise.all(this.pendingDeliveries);
    this.pendingDeliveries = null;
    return prompted;
  }

  send(text: string) {
    return this.prompt(text);
  }

  [Symbol.dispose]() {
    this.unsubscribePi();
    for (const listener of this.listeners) {
      const dispose = listener[Symbol.dispose];
      if (typeof dispose === "function") dispose.call(listener);
    }
    this.listeners.clear();
    void this.session.abort();
    this.session.dispose();
  }
}
