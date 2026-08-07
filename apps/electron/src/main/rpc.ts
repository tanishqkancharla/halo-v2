import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { dialog, type BrowserWindow } from "electron";
import fs from "node:fs";
import {
  AgentSessionApi,
  HaloApi,
  type PromptEventHandler,
  type WorkspaceInfo,
} from "../shared/rpc.js";
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
    // #region agent log
    fs.appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId: "A", location: "main/rpc.ts:listSessions", message: "list result shapes", data: { arrayPrototype: Object.getPrototypeOf(sessions)?.constructor?.name, sessions: sessions.map((session) => Object.fromEntries(Object.entries(session).map(([key, value]) => [key, { type: typeof value, prototype: value === null || value === undefined ? null : Object.getPrototypeOf(value)?.constructor?.name }]))) }, timestamp: Date.now() })}\n`,
    );
    // #endregion
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
    const target = new AgentSessionRpc(session);
    // #region agent log
    fs.appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId: "B", location: "main/rpc.ts:newAgentSession", message: "created RPC target", data: { constructor: target.constructor.name, agentSessionApi: target instanceof AgentSessionApi }, timestamp: Date.now() })}\n`,
    );
    // #endregion
    return target;
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
      const listener = this.listener;
      if (listener === null) return;
      this.deliveries = this.deliveries
        .then(() => {
          // #region agent log
          fs.appendFileSync(
            "/opt/cursor/logs/debug.log",
            `${JSON.stringify({ hypothesisId: "C", location: "main/rpc.ts:delivery", message: "calling retained listener", data: { listenerType: typeof listener, listenerPrototype: Object.getPrototypeOf(listener)?.constructor?.name, hasDispose: Symbol.dispose in listener }, timestamp: Date.now() })}\n`,
          );
          // #endregion
          return listener(streamEvent);
        })
        .then((result) => {
          // #region agent log
          fs.appendFileSync(
            "/opt/cursor/logs/debug.log",
            `${JSON.stringify({ hypothesisId: "C", location: "main/rpc.ts:delivery", message: "listener resolved", data: { resultType: typeof result, resultPrototype: result === null || result === undefined ? null : Object.getPrototypeOf(result)?.constructor?.name }, timestamp: Date.now() })}\n`,
          );
          // #endregion
        });
    });
  }

  getSessionId() {
    return this.session.sessionId;
  }

  subscribe(callback: PromptListener) {
    // Cap'n Web releases arg stubs when the call returns unless we dup().
    const retained =
      typeof callback.dup === "function" ? callback.dup() : callback;
    // #region agent log
    fs.appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId: "C", location: "main/rpc.ts:subscribe", message: "retained listener", data: { callbackType: typeof callback, callbackPrototype: Object.getPrototypeOf(callback)?.constructor?.name, retainedType: typeof retained, retainedPrototype: Object.getPrototypeOf(retained)?.constructor?.name, duplicated: retained !== callback }, timestamp: Date.now() })}\n`,
    );
    // #endregion
    this.listener = retained;
  }

  async prompt(text: string) {
    if (text.trim().length === 0) throw new EmptyPromptError();
    // #region agent log
    fs.appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId: "C,D", location: "main/rpc.ts:prompt", message: "prompt entered", data: { textLength: text.length, hasListener: this.listener !== null }, timestamp: Date.now() })}\n`,
    );
    // #endregion
    const prompted = await this.session
      .prompt(text)
      .catch((e) => new PromptFailedError({ cause: e }));
    // #region agent log
    fs.appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId: "D", location: "main/rpc.ts:prompt", message: "Pi prompt settled", data: { failed: prompted instanceof Error, errorName: prompted instanceof Error ? prompted.name : null }, timestamp: Date.now() })}\n`,
    );
    // #endregion
    if (prompted instanceof Error) throw prompted;
    await this.deliveries;
    // #region agent log
    fs.appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId: "C", location: "main/rpc.ts:prompt", message: "deliveries settled", data: {}, timestamp: Date.now() })}\n`,
    );
    // #endregion
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
