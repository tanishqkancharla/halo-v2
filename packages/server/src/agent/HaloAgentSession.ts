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
  sessionLogEventSchema,
  type SessionLogEvent,
  type ToolIdentity,
} from "@get-halo/shared/sessionLog";
import type { SessionSummary } from "@get-halo/shared/rpc";
import {
  createDurableStream,
  type DurableStream,
  type DurableStreamRecord,
} from "../DurableStream.js";
import { JsonlDurableStreamStorage } from "../JsonlDurableStreamStorage.js";
import type {
  WorkspaceLayout,
  WorkspaceService,
} from "../workspace/WorkspaceService.js";
import type { FilesystemService } from "../filesystem/FilesystemService.js";
import type { ToolRuntimeService } from "./runtime/ToolRuntimeService.js";
import { createAuthorizedCodingTools } from "./tools/codingTools.js";
import { createExecTool } from "./tools/execTool.js";
import { createWorkspaceResourceLoader } from "./workspacePrompt.js";
import {
  adaptPiEvent,
  interruptedSessionEvents,
  type PiEventAdapterState,
} from "./SessionLogAdapter.js";

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

export class SessionEventPersistenceError extends errore.createTaggedError({
  name: "SessionEventPersistenceError",
  message: "Could not persist events for session '$sessionId'",
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
  readonly events: DurableStream<SessionLogEvent>;
  private readonly unsubscribePiEvents: () => void;
  private adapterState: PiEventAdapterState = { activeRunId: undefined };
  private readonly pendingEventWrites: Promise<
    DurableStreamRecord<SessionLogEvent> | Error
  >[] = [];
  private eventWriteError: SessionEventPersistenceError | undefined;

  private constructor(
    private readonly piSession: AgentSession,
    events: DurableStream<SessionLogEvent>,
    toolIdentities: ReadonlyMap<string, ToolIdentity>,
  ) {
    this.events = events;
    this.unsubscribePiEvents = this.piSession.subscribe((event) => {
      const adapted = adaptPiEvent({
        state: this.adapterState,
        event,
        toolIdentities,
      });
      this.adapterState = adapted.state;
      this.queueEvents(adapted.events);
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
    const customTools = [
      ...createAuthorizedCodingTools({
        cwd: layout.root,
        filesystem: options.filesystem,
        authority: runtime,
      }),
      createExecTool({ runtime, runtimeDescription }),
    ];
    const created = await createAgentSession({
      cwd: layout.root,
      agentDir: layout.agentDir,
      sessionManager: manager,
      model,
      modelRuntime,
      noTools: "builtin",
      customTools,
      resourceLoader,
    }).catch((e) => new CreateAgentSessionError({ cause: e }));
    if (created instanceof Error) return created;
    const events = await createDurableStream({
      storage: new JsonlDurableStreamStorage({
        filesystem: options.filesystem,
        path: layout.sessionLogPath(manager.getSessionId()),
        valueSchema: sessionLogEventSchema,
      }),
    });
    if (events instanceof Error) {
      created.session.dispose();
      return new SessionEventPersistenceError({
        sessionId: manager.getSessionId(),
        cause: events,
      });
    }
    const toolIdentities = new Map(
      customTools.map((tool) => [
        tool.name,
        { path: tool.name, displayName: tool.label },
      ]),
    );
    const session = new HaloAgentSession(
      created.session,
      events,
      toolIdentities,
    );
    const recovered = await session.recoverInterruptedActivity();
    if (recovered instanceof Error) {
      session.unsubscribePiEvents();
      created.session.dispose();
      return recovered;
    }
    return session;
  }

  get sessionId() {
    return this.piSession.sessionId;
  }

  getSnapshot() {
    const records = [...this.events.snapshot()];
    const last = records.at(-1);
    return {
      records,
      cursor: last === undefined ? 0 : last.sequence,
    };
  }

  async appendEvents(events: readonly SessionLogEvent[]) {
    this.queueEvents(events);
    return await this.drainEventWrites();
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
    const persisted = await this.drainEventWrites();
    if (persisted instanceof Error) return persisted;
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
    const persisted = await this.drainEventWrites();
    if (persisted instanceof Error) return persisted;
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
    const persisted = await this.drainEventWrites();
    if (persisted instanceof Error) return persisted;
    if (sent instanceof Error) return sent;
  }

  async close() {
    const aborted = await this.abort();
    this.unsubscribePiEvents();
    this.piSession.dispose();
    const persisted = await this.drainEventWrites();
    if (persisted instanceof Error) return persisted;
    if (aborted instanceof Error) return aborted;
  }

  private queueEvents(events: readonly SessionLogEvent[]): void {
    for (const event of events) {
      this.pendingEventWrites.push(this.events.append(event));
    }
  }

  private async drainEventWrites() {
    while (this.pendingEventWrites.length > 0) {
      const results = await Promise.all(this.pendingEventWrites.splice(0));
      const error = results.find((result) => result instanceof Error);
      if (error instanceof Error) {
        this.eventWriteError = new SessionEventPersistenceError({
          sessionId: this.sessionId,
          cause: error,
        });
      }
    }
    return this.eventWriteError;
  }

  private async recoverInterruptedActivity() {
    const recoveryEvents = interruptedSessionEvents(
      this.events.snapshot().map((record) => record.value),
    );
    this.queueEvents(recoveryEvents);
    return await this.drainEventWrites();
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
