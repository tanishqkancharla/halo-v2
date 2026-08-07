import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentSession,
  type createAgentSession,
  type SessionManager,
} from "@mariozechner/pi-coding-agent";
import { describe, expect, test, vi } from "vitest";
import {
  CreateAgentSessionError,
  PiService,
  SessionNotFoundError,
} from "./pi-service.js";
import { WorkspaceService } from "./workspace-service.js";

type AgentSessionFactory = typeof createAgentSession;
type AgentSessionResult = Awaited<ReturnType<AgentSessionFactory>>;
type AgentSessionOptions = Parameters<AgentSessionFactory>[0];
type SessionListener = Parameters<AgentSession["subscribe"]>[0];

async function workspaceService(): Promise<WorkspaceService> {
  const root = await mkdtemp(join(tmpdir(), "halo-pi-service-"));
  const appDataDir = await mkdtemp(join(tmpdir(), "halo-pi-app-data-"));
  const workspace = new WorkspaceService(appDataDir);
  const selected = await workspace.select(root);
  if (selected instanceof Error) throw selected;
  return workspace;
}

function message(
  role: "user" | "assistant",
  text: string,
): Parameters<SessionManager["appendMessage"]>[0] {
  return {
    role,
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as Parameters<SessionManager["appendMessage"]>[0];
}

function successfulFactory() {
  const unsubscribe = vi.fn();
  const dispose = vi.fn();
  const abort = vi.fn().mockResolvedValue(undefined);
  const factory = vi.fn(async (options: AgentSessionOptions) => {
    let listener: SessionListener | undefined;
    const sessionId = options!.sessionManager!.getSessionId();
    const session = {
      get sessionId() {
        return sessionId;
      },
      abort,
      dispose,
      subscribe(nextListener: SessionListener) {
        listener = nextListener;
        return unsubscribe;
      },
      async prompt(prompt: string) {
        options!.sessionManager!.appendMessage(message("user", prompt));
        for (const delta of ["Hello", " there"]) {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta },
          } as Parameters<SessionListener>[0]);
        }
        options!.sessionManager!.appendMessage(
          message("assistant", "Hello there"),
        );
      },
    } as unknown as AgentSession;
    return { session } as AgentSessionResult;
  }) as AgentSessionFactory;
  return { abort, dispose, factory, unsubscribe };
}

describe("PiService", () => {
  test("createAgentSession streams and persists; list/read use SessionManager", async () => {
    const workspace = await workspaceService();
    const fake = successfulFactory();
    const service = new PiService(workspace, fake.factory);

    const session = await service.createAgentSession();
    expect(session).not.toBeInstanceOf(Error);
    if (session instanceof Error) return;

    const deltas: string[] = [];
    const unsubscribe = session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        deltas.push(event.assistantMessageEvent.delta);
      }
    });
    await session.prompt("Say hello");
    unsubscribe();
    session.dispose();

    expect(deltas).toEqual(["Hello", " there"]);
    expect(fake.dispose).toHaveBeenCalledOnce();

    const restarted = new PiService(workspace, fake.factory);
    await expect(restarted.listSessions()).resolves.toMatchObject([
      {
        sessionId: session.sessionId,
        title: "Say hello",
        state: "idle",
      },
    ]);
    await expect(restarted.readTranscript(session.sessionId)).resolves.toEqual({
      messages: [
        expect.objectContaining({ role: "user", text: "Say hello" }),
        expect.objectContaining({ role: "assistant", text: "Hello there" }),
      ],
    });
  });

  test("createAgentSession({ sessionId }) reopens a durable session", async () => {
    const workspace = await workspaceService();
    const fake = successfulFactory();
    const service = new PiService(workspace, fake.factory);
    const created = await service.createAgentSession();
    expect(created).not.toBeInstanceOf(Error);
    if (created instanceof Error) return;
    await created.prompt("First");
    created.dispose();

    const reopened = await service.createAgentSession({
      sessionId: created.sessionId,
    });
    expect(reopened).not.toBeInstanceOf(Error);
    if (reopened instanceof Error) return;
    expect(reopened.sessionId).toBe(created.sessionId);
    await reopened.prompt("Second");
    reopened.dispose();

    await expect(service.readTranscript(created.sessionId)).resolves.toEqual({
      messages: [
        expect.objectContaining({ role: "user", text: "First" }),
        expect.objectContaining({ role: "assistant", text: "Hello there" }),
        expect.objectContaining({ role: "user", text: "Second" }),
        expect.objectContaining({ role: "assistant", text: "Hello there" }),
      ],
    });
  });

  test("create failure returns CreateAgentSessionError; missing id is SessionNotFoundError", async () => {
    const workspace = await workspaceService();
    const factory = vi
      .fn()
      .mockRejectedValue(new Error("no credentials")) as AgentSessionFactory;
    const service = new PiService(workspace, factory);

    const failed = await service.createAgentSession();
    expect(failed).toBeInstanceOf(CreateAgentSessionError);

    const missing = await new PiService(
      workspace,
      successfulFactory().factory,
    ).createAgentSession({ sessionId: "does-not-exist" });
    expect(missing).toBeInstanceOf(SessionNotFoundError);
  });

  test("caller keeps AgentSession across prompts; dispose is caller-owned", async () => {
    const workspace = await workspaceService();
    const fake = successfulFactory();
    const service = new PiService(workspace, fake.factory);
    const session = await service.createAgentSession();
    expect(session).not.toBeInstanceOf(Error);
    if (session instanceof Error) return;

    await session.prompt("One");
    await session.prompt("Two");
    expect(fake.factory).toHaveBeenCalledOnce();
    expect(fake.dispose).not.toHaveBeenCalled();

    await session.abort();
    session.dispose();
    expect(fake.abort).toHaveBeenCalledOnce();
    expect(fake.dispose).toHaveBeenCalledOnce();
  });
});
