import type { Api, Model } from "@earendil-works/pi-ai";
import {
  AgentHarness,
  type AgentLane,
  type AgentTool,
  type AgentMessage,
  type AgentHarnessTool,
  LaneBusy,
  NoActiveOperation,
} from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import type { Session } from "@earendil-works/pi-agent-core/harness/session";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import * as errore from "errore";
import {
  sessionLogEventSchema,
  type SessionLogEvent,
  type ToolIdentity,
} from "@get-halo/shared/sessionLog";
import {
  createDurableStream,
  type DurableStream,
  type DurableStreamRecord,
} from "../DurableStream.js";
import { JsonlDurableStreamStorage } from "../JsonlDurableStreamStorage.js";
import type { WorkspaceLayout } from "../workspace/WorkspaceService.js";
import type { FilesystemService } from "../filesystem/FilesystemService.js";
import type { ToolRuntime } from "./runtime/ToolRuntime.js";
import { createAuthorizedCodingTools } from "./tools/codingTools.js";
import { createExecTool } from "./tools/execTool.js";
import { WorkspaceResourceLoader } from "./WorkspaceResourceLoader.js";
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

export class CreateAgentSessionError extends errore.createTaggedError({
  name: "CreateAgentSessionError",
  message: "Failed to create agent session",
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
  modelRuntime: ModelRuntime;
  model: Model<Api>;
  filesystem: FilesystemService;
  layout: WorkspaceLayout;
  toolRuntime: ToolRuntime;
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
    private readonly piSession: Session,
    private readonly harness: AgentHarness,
    private readonly lane: AgentLane,
    events: DurableStream<SessionLogEvent>,
    toolIdentities: ReadonlyMap<string, ToolIdentity>,
  ) {
    this.events = events;
    const subscriptions = (
      [
        "run_start",
        "run_end",
        "message_end",
        "message_update",
        "tool_start",
        "tool_update",
        "tool_end",
      ] as const
    ).map((type) =>
      this.harness.events.on(type, (event) => {
        const adapted = adaptPiEvent({
          state: this.adapterState,
          event,
          toolIdentities,
        });
        this.adapterState = adapted.state;
        this.queueEvents(adapted.events);
      }),
    );
    this.unsubscribePiEvents = () => {
      for (const unsubscribe of subscriptions) unsubscribe();
    };
  }

  static async attach(options: HaloAgentSessionOptions, stored: Session) {
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() => stored.close(BACKGROUND_CONTEXT));
    const layout = options.layout;
    const runtime = options.toolRuntime;
    const runtimeDescription = await runtime.getAgentDescription();
    if (runtimeDescription instanceof Error) return runtimeDescription;

    const resourceLoader = new WorkspaceResourceLoader(layout.root);
    const reloaded = await resourceLoader.reload();
    if (reloaded instanceof Error) return reloaded;
    const customTools: AgentHarnessTool<object | undefined>[] = [
      ...createAuthorizedCodingTools({
        cwd: layout.root,
        filesystem: options.filesystem,
        authority: runtime,
      }).map((tool: AgentTool): AgentHarnessTool<object | undefined> => ({
        ...tool,
        execute: (id, params, onUpdate, _toolContext, _invocation, context) =>
          tool.execute(id, params, context.abortSignal, onUpdate),
      })),
      createExecTool({
        runtime,
        runtimeDescription,
        modelId: options.model.id,
      }),
    ];
    const created = await AgentHarness.create(
      {
        session: stored,
        models: options.modelRuntime,
        model: options.model,
        tools: customTools,
        systemPrompt: resourceLoader.getSystemPrompt(),
        resources: resourceLoader.getResources(),
      },
      BACKGROUND_CONTEXT,
    ).catch((cause) => new CreateAgentSessionError({ cause }));
    if (created instanceof Error) return created;
    cleanup.defer(() => created.harness.close(BACKGROUND_CONTEXT));
    // Attaching Pi restores unfinished operations without running them; Halo cancels them before accepting new work.
    for (const operation of created.open) {
      const recovering = await created.harness.lane(
        operation.lane,
        BACKGROUND_CONTEXT,
      );
      const aborted = await recovering.abort(BACKGROUND_CONTEXT);
      if (!aborted.ok)
        return new CreateAgentSessionError({ cause: aborted.error });
    }
    const lane = await created.harness.lane(
      "main",
      // oxlint-disable-next-line unicorn/no-null -- Pi uses null for an empty branch tip.
      { createAt: null },
      BACKGROUND_CONTEXT,
    );
    const events = await createDurableStream({
      storage: new JsonlDurableStreamStorage({
        filesystem: options.filesystem,
        path: layout.sessionLogPath(stored.metadata.id),
        valueSchema: sessionLogEventSchema,
      }),
    });
    if (events instanceof Error) {
      return new SessionEventPersistenceError({
        sessionId: stored.metadata.id,
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
      stored,
      created.harness,
      lane,
      events,
      toolIdentities,
    );
    const recovered = await session.recoverInterruptedActivity();
    if (recovered instanceof Error) {
      session.unsubscribePiEvents();
      return recovered;
    }
    cleanup.move();
    return session;
  }

  get sessionId() {
    return this.piSession.metadata.id;
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
    for (const event of events) {
      if (event.type !== "message.committed") {
        this.queueEvents([event]);
        continue;
      }
      const appended = await this.lane
        .appendMessage(
          event.message.role === "bashExecution"
            ? { ...event.message, exitCode: event.message.exitCode }
            : event.message,
          BACKGROUND_CONTEXT,
        )
        .catch(
          (cause) =>
            new SessionEventPersistenceError({
              sessionId: this.sessionId,
              cause,
            }),
        );
      if (appended instanceof Error) return appended;
    }
    return await this.drainEventWrites();
  }

  async setName(name: string) {
    return this.harness.setName(name, BACKGROUND_CONTEXT).catch(
      (cause) =>
        new SessionEventPersistenceError({
          sessionId: this.sessionId,
          cause,
        }),
    );
  }

  async prompt(text: string) {
    if (text.trim().length === 0) return new EmptyPromptError();
    return this.send({ role: "user", content: text, timestamp: Date.now() });
  }

  private async send(message: AgentMessage) {
    const prompted = await this.lane
      .prompt(message, BACKGROUND_CONTEXT)
      .catch(
        (cause) => new PromptFailedError({ reason: "Prompt failed", cause }),
      );
    if (prompted instanceof Error) return prompted;
    if (!prompted.ok) {
      if (!(prompted.error instanceof LaneBusy))
        return new PromptFailedError({
          reason: prompted.error.message,
          cause: prompted.error,
        });
      const queued = await this.lane
        .steer(message, undefined, BACKGROUND_CONTEXT)
        .catch(
          (cause) =>
            new PromptFailedError({ reason: "Could not queue message", cause }),
        );
      if (queued instanceof Error) return queued;
      if (!queued.ok)
        return new PromptFailedError({
          reason: queued.error.message,
          cause: queued.error,
        });
    }
    return this.drainEventWrites();
  }

  async abort() {
    const aborted = await this.lane
      .abort(BACKGROUND_CONTEXT)
      .catch(
        (cause) => new AbortFailedError({ reason: "Abort failed", cause }),
      );
    if (aborted instanceof Error) return aborted;
    if (!aborted.ok && !(aborted.error instanceof NoActiveOperation))
      return new AbortFailedError({
        reason: aborted.error.message,
        cause: aborted.error,
      });
    return this.drainEventWrites();
  }

  async notify(input: SessionNotification) {
    return this.send({
      role: "custom",
      ...input,
      display: false,
      timestamp: Date.now(),
    });
  }

  async close() {
    const closed = await this.harness
      .close(BACKGROUND_CONTEXT)
      .catch(
        (cause) =>
          new AbortFailedError({ reason: "Session close failed", cause }),
      );
    this.unsubscribePiEvents();
    const persisted = await this.drainEventWrites();
    if (closed instanceof Error) return closed;
    return persisted;
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
