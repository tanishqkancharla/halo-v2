import {
  createAgentSession,
  SessionManager,
  type AgentSession,
  type SessionInfo,
} from "@mariozechner/pi-coding-agent";
import * as errore from "errore";
import {
  agentSessionStateFromSession,
  type AgentSessionState,
} from "../../shared/AgentSessionState.js";
import type { AgentSessionEvent, SessionSummary } from "../../shared/rpc.js";
import type { IntegrationService } from "../integrations/IntegrationService.js";
import { createIntegrationTools } from "../integrations/IntegrationTools.js";
import type { UserService } from "../UserService.js";
import type {
  WorkspaceLayout,
  WorkspaceService,
} from "../workspace/WorkspaceService.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import {
  AbortFailedError,
  EmptyPromptError,
  PromptFailedError,
} from "./AgentSessionErrors.js";
import { createExecTool } from "./execTool.js";
import type { ToolRuntimeService } from "./executor/ToolRuntimeService.js";
import { createParallelSearchTools } from "./ParallelSearchTools.js";
import type { HaloToolPluginFactory } from "./tools/HaloToolPlugin.js";
import { createWorkspaceResourceLoader } from "./workspacePrompt.js";

export class SessionNotFoundError extends errore.createTaggedError({
  name: "SessionNotFoundError",
  message: "Session '$sessionId' does not exist.",
}) {}

export class CreateAgentSessionError extends errore.createTaggedError({
  name: "CreateAgentSessionError",
  message: "Failed to create agent session",
}) {}

export class ListAgentSessionsError extends errore.createTaggedError({
  name: "ListAgentSessionsError",
  message: "Failed to list agent sessions",
}) {}

export class OpenAgentSessionError extends errore.createTaggedError({
  name: "OpenAgentSessionError",
  message: "Failed to open agent session '$sessionId'",
}) {}

export class NotifyIntegrationEventError extends errore.createTaggedError({
  name: "NotifyIntegrationEventError",
  message: "Failed to notify the agent after an integration change",
}) {}

type SessionNotification = {
  customType: "halo.integration.connected" | "halo.integration.disconnected";
  content: string;
};

export type HaloAgentSessionOptions = {
  workspace: WorkspaceService;
  user: UserService;
  integrations: IntegrationService;
  toolRuntime: ToolRuntimeService;
  toolPluginFactories: readonly HaloToolPluginFactory[];
  authority: AgentAuthority;
};

type SessionListener = (event: AgentSessionEvent) => void;

export class HaloAgentSession {
  private constructor(private readonly piSession: AgentSession) {}

  static async create(options: HaloAgentSessionOptions) {
    const layout = options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = errore.try({
      try: () => SessionManager.create(layout.root, layout.sessionDir),
      catch: (e) => new CreateAgentSessionError({ cause: e }),
    });
    if (manager instanceof Error) return manager;
    return HaloAgentSession.createFromManager(options, layout, manager);
  }

  static async open(options: HaloAgentSessionOptions & { sessionId: string }) {
    const layout = options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const sessions = await SessionManager.list(
      layout.root,
      layout.sessionDir,
    ).catch((e) => new ListAgentSessionsError({ cause: e }));
    if (sessions instanceof Error) return sessions;
    const session = sessions.find(
      (candidate) => candidate.id === options.sessionId,
    );
    if (session === undefined) {
      return new SessionNotFoundError({ sessionId: options.sessionId });
    }
    const manager = errore.try({
      try: () => SessionManager.open(session.path, layout.sessionDir),
      catch: (e) =>
        new OpenAgentSessionError({
          sessionId: options.sessionId,
          cause: e,
        }),
    });
    if (manager instanceof Error) return manager;
    return HaloAgentSession.createFromManager(options, layout, manager);
  }

  static async list(options: Pick<HaloAgentSessionOptions, "workspace">) {
    const layout = options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const sessions = await SessionManager.list(
      layout.root,
      layout.sessionDir,
    ).catch((e) => new ListAgentSessionsError({ cause: e }));
    if (sessions instanceof Error) return sessions;
    return sessions
      .map((session) => sessionSummary(session))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private static async createFromManager(
    options: HaloAgentSessionOptions,
    layout: WorkspaceLayout,
    manager: SessionManager,
  ) {
    const user = await options.user.getUser();
    if (user instanceof Error) return user;
    const toolPlugins = options.toolPluginFactories.map((createPlugin) =>
      createPlugin({ workspaceRoot: layout.root }),
    );
    const runtime = await options.toolRuntime.get({
      workspaceRoot: layout.root,
      userId: user.id,
      toolPlugins,
      authority: options.authority,
    });
    if (runtime instanceof Error) return runtime;

    const resourceLoader = createWorkspaceResourceLoader(
      layout.root,
      layout.agentDir,
    );
    const reloaded = await resourceLoader
      .reload()
      .catch((e) => new CreateAgentSessionError({ cause: e }));
    if (reloaded instanceof Error) return reloaded;
    const created = await createAgentSession({
      cwd: layout.root,
      agentDir: layout.agentDir,
      sessionManager: manager,
      tools: [],
      customTools: [
        createExecTool(runtime),
        ...createParallelSearchTools(user.id),
        ...createIntegrationTools(options.integrations),
      ],
      resourceLoader,
    }).catch((e) => new CreateAgentSessionError({ cause: e }));
    if (created instanceof Error) return created;
    return new HaloAgentSession(created.session);
  }

  get sessionId() {
    return this.piSession.sessionId;
  }

  getState(): AgentSessionState {
    return agentSessionStateFromSession({
      messages: this.piSession.messages,
      isStreaming: this.piSession.isStreaming,
    });
  }

  subscribe(listener: SessionListener) {
    return this.piSession.subscribe(listener);
  }

  async prompt(text: string) {
    if (text.trim().length === 0) return new EmptyPromptError();
    const prompted = await this.piSession
      .prompt(text, { streamingBehavior: "steer" })
      .catch(
        (e) =>
          new PromptFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
    if (prompted instanceof Error) return prompted;
  }

  async abort() {
    const aborted = await this.piSession.abort().catch(
      (e) =>
        new AbortFailedError({
          reason: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    );
    if (aborted instanceof Error) return aborted;
  }

  async notify(input: SessionNotification) {
    const sent = await this.piSession
      .sendCustomMessage(
        {
          customType: input.customType,
          content: input.content,
          display: false,
        },
        { triggerTurn: true, deliverAs: "steer" },
      )
      .catch((e) => new NotifyIntegrationEventError({ cause: e }));
    if (sent instanceof Error) return sent;
  }

  async close() {
    const aborted = await this.abort();
    this.piSession.dispose();
    if (aborted instanceof Error) return aborted;
  }
}

function sessionSummary(session: SessionInfo): SessionSummary {
  const title =
    session.name === undefined ? session.firstMessage : session.name;
  return {
    sessionId: session.id,
    agent: "pi",
    cwd: session.cwd,
    title: title.trim().length === 0 ? undefined : title,
    createdAt: session.created.toISOString(),
    updatedAt: session.modified.toISOString(),
  };
}
