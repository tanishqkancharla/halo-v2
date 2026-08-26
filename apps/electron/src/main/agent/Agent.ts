import {
  createAgentSession,
  SessionManager,
  type SessionInfo,
} from "@mariozechner/pi-coding-agent";
import * as errore from "errore";
import type { SessionSummary } from "../../shared/rpc.js";
import type { IntegrationService } from "../integrations/IntegrationService.js";
import { createIntegrationTools } from "../integrations/IntegrationTools.js";
import type { UserService } from "../UserService.js";
import {
  WorkspaceService,
  type WorkspaceLayout,
} from "../workspace/WorkspaceService.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import { createExecTool } from "./execTool.js";
import { ToolRuntimeService } from "./executor/ToolRuntimeService.js";
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

type AgentOptions = {
  workspace: WorkspaceService;
  user: UserService;
  integrations: IntegrationService;
  toolPluginFactories: readonly HaloToolPluginFactory[];
  authority: AgentAuthority;
};

/**
 * Halo's agent façade. Pi and Executor remain private implementation details.
 */
export class Agent {
  private readonly toolRuntime = new ToolRuntimeService();

  constructor(private readonly options: AgentOptions) {}

  close() {
    return this.toolRuntime.close();
  }

  async newAgentSession() {
    const layout = this.options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = SessionManager.create(layout.root, layout.sessionDir);
    return this.createAgentSession(layout, manager);
  }

  async openAgentSession(sessionId: string) {
    const layout = this.options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = await this.openSessionManager(layout, sessionId);
    if (manager instanceof Error) return manager;
    return this.createAgentSession(layout, manager);
  }

  private async createAgentSession(
    layout: WorkspaceLayout,
    manager: SessionManager,
  ) {
    const user = await this.options.user.getUser();
    if (user instanceof Error) return user;
    const toolPlugins = this.options.toolPluginFactories.map((createPlugin) =>
      createPlugin({ workspaceRoot: layout.root }),
    );
    const runtime = await this.toolRuntime.get({
      workspaceRoot: layout.root,
      userId: user.id,
      toolPlugins,
      authority: this.options.authority,
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
        ...createIntegrationTools(this.options.integrations),
      ],
      resourceLoader,
    }).catch((e) => new CreateAgentSessionError({ cause: e }));
    if (created instanceof Error) return created;
    return created.session;
  }

  async listSessions() {
    const layout = this.options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    return sessions
      .map((session) => sessionSummary(session))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async openSessionManager(layout: WorkspaceLayout, sessionId: string) {
    const sessions = await SessionManager.list(layout.root, layout.sessionDir);
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined) return new SessionNotFoundError({ sessionId });
    return SessionManager.open(session.path, layout.sessionDir);
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
