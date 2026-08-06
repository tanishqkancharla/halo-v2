import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentSession,
  type createAgentSession,
  type SessionManager,
} from "@mariozechner/pi-coding-agent";
import { describe, expect, test, vi } from "vitest";
import { PiService } from "./pi-service.js";
import { WorkspaceService } from "./workspace-service.js";

type AgentSessionFactory = typeof createAgentSession;
type AgentSessionResult = Awaited<ReturnType<AgentSessionFactory>>;
type AgentSessionOptions = Parameters<AgentSessionFactory>[0];
type SessionListener = Parameters<AgentSession["subscribe"]>[0];

async function workspaceService(): Promise<WorkspaceService> {
  const root = await mkdtemp(join(tmpdir(), "halo-pi-service-"));
  const appDataDir = await mkdtemp(join(tmpdir(), "halo-pi-app-data-"));
  const workspace = new WorkspaceService(appDataDir);
  await workspace.select(root);
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
    let listener: SessionListener;
    const session = {
      abort,
      dispose,
      subscribe(nextListener: SessionListener) {
        listener = nextListener;
        return unsubscribe;
      },
      async prompt(prompt: string) {
        options!.sessionManager!.appendMessage(message("user", prompt));
        for (const delta of ["Hello", " there"]) {
          listener({
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
  test("streams and persists a new session", async () => {
    const workspace = await workspaceService();
    const fake = successfulFactory();
    const service = new PiService(workspace, fake.factory);
    const session = await service.createNewSession();
    const deltas: string[] = [];

    await service.sendPrompt(session.sessionId, "Say hello", (event) => {
      deltas.push(event.text);
    });

    expect(deltas).toEqual(["Hello", " there"]);
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
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

  test("cleans up after a prompt error and allows a retry", async () => {
    const workspace = await workspaceService();
    const succeeding = successfulFactory();
    const failedDispose = vi.fn();
    const failingSession = {
      abort: vi.fn().mockResolvedValue(undefined),
      dispose: failedDispose,
      subscribe: vi.fn(() => vi.fn()),
      prompt: vi.fn().mockRejectedValue(new Error("provider failed")),
    } as unknown as AgentSession;
    const factory = vi
      .fn()
      .mockResolvedValueOnce({ session: failingSession })
      .mockImplementation(succeeding.factory) as AgentSessionFactory;
    const service = new PiService(workspace, factory);
    const session = await service.createNewSession();

    await expect(
      service.sendPrompt(session.sessionId, "First", vi.fn()),
    ).rejects.toThrow("provider failed");
    expect(failedDispose).toHaveBeenCalledOnce();
    await expect(
      service.sendPrompt(session.sessionId, "Retry", vi.fn()),
    ).resolves.toBeUndefined();
  });

  test("rejects concurrent prompts and aborts on shutdown", async () => {
    const workspace = await workspaceService();
    let finishPrompt: (() => void) | undefined;
    const promptDone = new Promise<void>((resolve) => {
      finishPrompt = resolve;
    });
    const abort = vi.fn(() => {
      finishPrompt!();
      return Promise.resolve();
    });
    const dispose = vi.fn();
    const session = {
      abort,
      dispose,
      subscribe: vi.fn(() => vi.fn()),
      prompt: vi.fn(() => promptDone),
    } as unknown as AgentSession;
    const factory = vi
      .fn()
      .mockResolvedValue({ session }) as AgentSessionFactory;
    const service = new PiService(workspace, factory);
    const created = await service.createNewSession();
    const running = service.sendPrompt(created.sessionId, "Wait", vi.fn());
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledOnce());

    await expect(
      service.sendPrompt(created.sessionId, "Again", vi.fn()),
    ).rejects.toThrow("already running");
    await service.shutdown();
    await running;

    expect(abort).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalled();
  });
});
