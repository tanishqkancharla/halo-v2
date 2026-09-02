import { join } from "node:path";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSession,
  type SessionInfo,
} from "@earendil-works/pi-coding-agent";
import * as errore from "errore";
import {
  agentSessionStateFromSession,
  type AgentSessionState,
} from "@get-halo/shared/AgentSessionState";
import type { AgentSessionEvent, SessionSummary } from "@get-halo/shared/rpc";
import { type ReadonlyStream, Stream } from "../Stream.js";
import type {
  WorkspaceLayout,
  WorkspaceService,
} from "../workspace/WorkspaceService.js";
import type { FilesystemService } from "../filesystem/FilesystemService.js";
import type { ToolRuntimeService } from "./runtime/ToolRuntimeService.js";
import { createAuthorizedCodingTools } from "./tools/codingTools.js";
import { createExecTool } from "./tools/execTool.js";
import { createWorkspaceResourceLoader } from "./workspacePrompt.js";

export class EmptyPromptError extends errore.createTaggedError({
  name: "EmptyPromptError",
  message: "Enter a prompt first.",
}) {}

export class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "$reason",
}) {}

export class AbortFailedError extends errore.createTaggedError({
  name: "AbortFailedError",
  message: "$reason",
}) {}

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
  customType: "halo.integration.connected";
  content: string;
};

export type HaloAgentSessionOptions = {
  filesystem: FilesystemService;
  workspace: WorkspaceService;
  toolRuntime: ToolRuntimeService;
};

export class HaloAgentSession {
  private readonly eventStream = new Stream<AgentSessionEvent>();
  readonly events: ReadonlyStream<AgentSessionEvent> = this.eventStream;
  private readonly unsubscribePiEvents: () => void;

  private constructor(private readonly piSession: AgentSession) {
    this.unsubscribePiEvents = this.piSession.subscribe((event) => {
      this.eventStream.append(event);
    });
  }

  static async create(options: HaloAgentSessionOptions) {
    const layout = options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const manager = errore.try({
      try: () => SessionManager.create(layout.root, layout.sessionDir),
      catch: (e) => new CreateAgentSessionError({ cause: e }),
    });
    if (manager instanceof Error) return manager;
    return await HaloAgentSession.createFromManager(options, layout, manager);
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
    return await HaloAgentSession.createFromManager(options, layout, manager);
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
    const runtime = await options.toolRuntime.get();
    if (runtime instanceof Error) return runtime;
    const runtimeDescription = await runtime.getAgentDescription();
    if (runtimeDescription instanceof Error) return runtimeDescription;

    const resourceLoader = createWorkspaceResourceLoader(
      layout.root,
      layout.agentDir,
    );
    const reloaded = await resourceLoader
      .reload()
      .catch((e) => new CreateAgentSessionError({ cause: e }));
    if (reloaded instanceof Error) return reloaded;
    registerBunOAuthFlows();
    const modelRuntime = await ModelRuntime.create({
      modelsPath: join(layout.agentDir, "models.json"),
    }).catch((e) => new CreateAgentSessionError({ cause: e }));
    if (modelRuntime instanceof Error) return modelRuntime;
    const model = modelRuntime
      .getModels("openai-codex")
      .find(({ id }) => id === "gpt-5.6-terra");
    if (model === undefined) {
      return new CreateAgentSessionError({
        cause: new Error("Pi is missing GPT-5.6 Terra"),
      });
    }
    const created = await createAgentSession({
      cwd: layout.root,
      agentDir: layout.agentDir,
      sessionManager: manager,
      model,
      modelRuntime,
      noTools: "builtin",
      customTools: [
        ...createAuthorizedCodingTools({
          cwd: layout.root,
          filesystem: options.filesystem,
          authority: runtime,
        }),
        createExecTool({ runtime, runtimeDescription }),
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
    this.unsubscribePiEvents();
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
