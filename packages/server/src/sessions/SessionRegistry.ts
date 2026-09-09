import { contentText } from "@earendil-works/pi-ai";
import * as errore from "errore";
import {
  BACKGROUND_CONTEXT,
  type JsonlSessionRepo,
  type JsonlSessionMetadata,
  type Session,
} from "@earendil-works/pi-agent-core";
import type { SessionSummary } from "@get-halo/shared/rpc";
import {
  HaloAgentSession,
  CreateAgentSessionError,
  type HaloAgentSessionOptions,
} from "../agent/HaloAgentSession.js";

export class SessionNotFoundError extends errore.createTaggedError({
  name: "SessionNotFoundError",
  message: "Session '$sessionId' does not exist.",
}) {}

export class ListAgentSessionsError extends errore.createTaggedError({
  name: "ListAgentSessionsError",
  message: "Failed to list agent sessions",
}) {}

export class OpenAgentSessionError extends errore.createTaggedError({
  name: "OpenAgentSessionError",
  message: "Failed to open agent session '$sessionId'",
}) {}

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

class CloseSessionRepositoryError extends errore.createTaggedError({
  name: "CloseSessionRepositoryError",
  message: "Could not close the session repository",
}) {}

type SessionRegistryOptions = HaloAgentSessionOptions & {
  repo: JsonlSessionRepo;
};

export class SessionRegistry {
  private readonly sessions = new Map<string, HaloAgentSession>();
  private readonly stored = new Map<string, Promise<Session | Error>>();
  private readonly opening = new Map<
    string,
    Promise<Error | HaloAgentSession>
  >();
  constructor(private readonly options: SessionRegistryOptions) {}

  async list() {
    const metadata = await this.options.repo
      .list(undefined, BACKGROUND_CONTEXT)
      .catch((cause) => new ListAgentSessionsError({ cause }));
    if (metadata instanceof Error) return metadata;
    const summaries: SessionSummary[] = [];
    for (const item of metadata) {
      const stored = await this.openStored(item);
      if (stored instanceof Error) return stored;
      const summary = await readSessionSummary(
        stored,
        this.options.layout.root,
      ).catch((cause) => new ListAgentSessionsError({ cause }));
      if (summary instanceof Error) return summary;
      summaries.push(summary);
    }
    return summaries.toSorted((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  async create() {
    const stored = await this.options.repo
      .create({ cwd: this.options.layout.root }, BACKGROUND_CONTEXT)
      .catch((cause) => new CreateAgentSessionError({ cause }));
    if (stored instanceof Error) return stored;
    this.stored.set(stored.metadata.id, Promise.resolve(stored));
    return this.open(stored.metadata.id);
  }

  async open(sessionId: string) {
    const live = this.sessions.get(sessionId);
    if (live !== undefined) return live;
    const pending = this.opening.get(sessionId);
    if (pending !== undefined) return await pending;

    const opening = this.openAndRegister(sessionId);
    this.opening.set(sessionId, opening);
    const session = await opening;
    this.opening.delete(sessionId);
    return session;
  }

  async close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return new SessionNotOpenError({ sessionId });
    this.sessions.delete(sessionId);
    this.stored.delete(sessionId);
    return await session.close();
  }

  async shutdown() {
    const opening = [...this.opening.values()];
    await Promise.all(opening);
    this.opening.clear();

    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    const closed = await Promise.all(
      sessions.map((session) => session.close()),
    );
    const sessionError = closed.find((result) => result instanceof Error);
    const repoClosed = await this.options.repo
      .close(BACKGROUND_CONTEXT)
      .catch((cause) => new CloseSessionRepositoryError({ cause }));
    this.stored.clear();
    if (sessionError instanceof Error) return sessionError;
    if (repoClosed instanceof Error) return repoClosed;
  }

  private async openAndRegister(sessionId: string) {
    const existing = this.stored.get(sessionId);
    const stored =
      existing === undefined
        ? await this.findStored(sessionId)
        : await existing;
    if (stored instanceof Error) return stored;
    const session = await HaloAgentSession.attach(this.options, stored);
    if (session instanceof Error) {
      this.stored.delete(sessionId);
      return session;
    }
    this.register(session);
    return session;
  }

  private async findStored(sessionId: string) {
    const metadata = await this.options.repo
      .list(undefined, BACKGROUND_CONTEXT)
      .catch((cause) => new ListAgentSessionsError({ cause }));
    if (metadata instanceof Error) return metadata;
    const item = metadata.find((candidate) => candidate.id === sessionId);
    if (item === undefined) return new SessionNotFoundError({ sessionId });
    return this.openStored(item);
  }

  private async openStored(metadata: JsonlSessionMetadata) {
    const existing = this.stored.get(metadata.id);
    if (existing !== undefined) return existing;
    const opening = this.options.repo
      .open(metadata, BACKGROUND_CONTEXT)
      .catch(
        (cause) => new OpenAgentSessionError({ sessionId: metadata.id, cause }),
      );
    this.stored.set(metadata.id, opening);
    const stored = await opening;
    if (stored instanceof Error) this.stored.delete(metadata.id);
    return stored;
  }

  private register(session: HaloAgentSession) {
    this.sessions.set(session.sessionId, session);
  }
}

async function readSessionSummary(session: Session, cwd: string) {
  const name = await session.getName(BACKGROUND_CONTEXT);
  const entries = await session.findEntries(
    { order: "asc" },
    BACKGROUND_CONTEXT,
  );
  const first = entries.find(
    (entry) => entry.type === "message" && entry.message.role === "user",
  );
  const firstMessage =
    first?.type === "message" && first.message.role === "user"
      ? contentText(first.message.content)
      : "";
  const title = name === undefined ? firstMessage : name;
  const latest = entries.at(-1);
  return {
    sessionId: session.metadata.id,
    agent: "pi" as const,
    cwd,
    title: title.trim().length === 0 ? undefined : title,
    createdAt: new Date(session.metadata.createdAt).toISOString(),
    updatedAt: new Date(
      latest === undefined ? session.metadata.createdAt : latest.timestamp,
    ).toISOString(),
  };
}
