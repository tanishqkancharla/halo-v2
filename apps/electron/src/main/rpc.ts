import type {
  AgentSession,
  AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import type { Logger } from "@repo/logger";
import { dialog, type BrowserWindow } from "electron";
import { agentSessionStateFromSession } from "../shared/AgentSessionState.js";
import {
  AgentSessionApi,
  HaloApi,
  type AgentSessionEventHandler,
  type AppInfo,
  type OpenedAgentSession,
  type WorkspaceInfo,
  type WorkspaceTreeEventHandler,
} from "../shared/rpc.js";
import { EmptyPromptError, PromptFailedError } from "./agent-session-errors.js";
import { getAppInfo } from "./AppUpdate.js";
import type { PiService } from "./pi-service.js";
import type { WorkspaceService } from "./workspace-service.js";

type TreeListener = WorkspaceTreeEventHandler & {
  dup?: () => WorkspaceTreeEventHandler & Disposable;
} & Partial<Disposable>;

export class HaloRpc extends HaloApi {
  private treeListener: TreeListener | undefined;

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly pi: PiService,
    private readonly getWindow: () => BrowserWindow,
    private readonly logger: Logger,
  ) {
    super();
  }

  getAppInfo(): AppInfo {
    return getAppInfo();
  }

  getWorkspace(): WorkspaceInfo | undefined {
    this.logger.info({ event: "getWorkspace" });
    return this.workspace.getWorkspace();
  }

  async chooseWorkspace() {
    this.logger.info({ event: "chooseWorkspace" });
    const selection = await dialog.showOpenDialog(this.getWindow(), {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return undefined;
    const workspace = await this.workspace.select(selection.filePaths[0]!);
    if (workspace instanceof Error) throw workspace;
    return workspace;
  }

  async listSessions() {
    this.logger.info({ event: "listSessions" });
    const sessions = await this.pi.listSessions();
    if (sessions instanceof Error) throw sessions;
    return sessions;
  }

  async listWorkspacePaths() {
    this.logger.info({ event: "listWorkspacePaths" });
    const paths = await this.workspace.listPaths();
    if (paths instanceof Error) throw paths;
    return paths;
  }

  subscribeWorkspaceTree(callback: TreeListener) {
    this.logger.info({ event: "subscribeWorkspaceTree" });
    const previous = this.treeListener;
    this.treeListener = callback.dup === undefined ? callback : callback.dup();
    if (previous !== undefined) {
      const dispose = previous[Symbol.dispose];
      if (dispose !== undefined) dispose.call(previous);
    }
    this.workspace.setTreeListener((events) => {
      const listener = this.treeListener;
      if (listener === undefined) return;
      listener(events);
    });
  }

  async newAgentSession() {
    this.logger.info({ event: "newAgentSession" });
    const session = await this.pi.newAgentSession();
    if (session instanceof Error) throw session;
    return new AgentSessionRpc(
      session,
      this.logger.scope("agentSession", { sessionId: session.sessionId }),
    );
  }

  async openAgentSession(sessionId: string): Promise<OpenedAgentSession> {
    this.logger.info({ event: "openAgentSession", sessionId });
    const session = await this.pi.openAgentSession(sessionId);
    if (session instanceof Error) throw session;
    return {
      state: agentSessionStateFromSession({ messages: session.messages }),
      session: new AgentSessionRpc(
        session,
        this.logger.scope("agentSession", { sessionId: session.sessionId }),
      ),
    };
  }
}

type SessionListener = AgentSessionEventHandler & {
  dup?: () => AgentSessionEventHandler & Disposable;
} & Partial<Disposable>;

/** Cap'n Web stub wrapping a live Pi AgentSession. Forwards raw Pi events. */
export class AgentSessionRpc extends AgentSessionApi {
  private listener: SessionListener | undefined;
  private deliveries = Promise.resolve();
  private readonly unsubscribePi: () => void;

  constructor(
    private readonly session: AgentSession,
    private readonly logger: Logger,
  ) {
    super();
    this.unsubscribePi = session.subscribe((event: AgentSessionEvent) => {
      const listener = this.listener;
      if (listener === undefined) return;
      this.deliveries = this.deliveries.then(() => listener(event));
    });
  }

  getSessionId() {
    this.logger.info({ event: "getSessionId" });
    return this.session.sessionId;
  }

  subscribe(callback: SessionListener) {
    this.logger.info({ event: "subscribe" });
    // Cap'n Web releases arg stubs when the call returns unless we dup().
    this.listener = callback.dup === undefined ? callback : callback.dup();
  }

  async prompt(text: string) {
    this.logger.info({ event: "prompt", textLength: text.length });
    if (text.trim().length === 0) throw new EmptyPromptError();
    const prompted = await this.session
      .prompt(text)
      .catch((e) => new PromptFailedError({ cause: e }));
    if (prompted instanceof Error) throw prompted;
    await this.deliveries;
  }

  [Symbol.dispose]() {
    this.logger.info({ event: "dispose" });
    this.unsubscribePi();
    const listener = this.listener;
    if (listener !== undefined) {
      const dispose = listener[Symbol.dispose];
      if (dispose !== undefined) dispose.call(listener);
    }
    this.listener = undefined;
    void this.session.abort().catch((error) => {
      this.logger.warn({ event: "abort-failed", error });
    });
    this.session.dispose();
  }
}
