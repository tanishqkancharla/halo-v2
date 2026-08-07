import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";
import {
  type AgentSession,
  type createAgentSession,
  type SessionManager,
} from "@mariozechner/pi-coding-agent";
import { newMessagePortRpcSession } from "capnweb";
import { describe, expect, test, vi } from "vitest";
import { HaloRpc } from "./halo-rpc.js";
import { PiService } from "./pi-service.js";
import { WorkspaceService } from "./workspace-service.js";

type AgentSessionFactory = typeof createAgentSession;
type AgentSessionResult = Awaited<ReturnType<AgentSessionFactory>>;
type AgentSessionOptions = Parameters<AgentSessionFactory>[0];
type SessionListener = Parameters<AgentSession["subscribe"]>[0];

async function workspaceService(): Promise<WorkspaceService> {
  const root = await mkdtemp(join(tmpdir(), "halo-rpc-"));
  const appDataDir = await mkdtemp(join(tmpdir(), "halo-rpc-app-"));
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

function streamingFactory() {
  const factory = vi.fn(async (options: AgentSessionOptions) => {
    let listener: SessionListener;
    const session = {
      abort: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      subscribe(nextListener: SessionListener) {
        listener = nextListener;
        return vi.fn();
      },
      async prompt(prompt: string) {
        options!.sessionManager!.appendMessage(message("user", prompt));
        for (const delta of ["Cap", "n"]) {
          listener({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta },
          } as Parameters<SessionListener>[0]);
        }
        options!.sessionManager!.appendMessage(message("assistant", "Capn"));
      },
    } as unknown as AgentSession;
    return { session } as AgentSessionResult;
  }) as AgentSessionFactory;
  return factory;
}

describe("HaloRpc Cap'n Web session", () => {
  test("subscribe receives prompt deltas across MessagePort", async () => {
    const workspace = await workspaceService();
    const pi = new PiService(workspace, streamingFactory());
    const created = await pi.createNewSession();
    expect(created).not.toBeInstanceOf(Error);
    if (created instanceof Error) return;

    const { port1, port2 } = new MessageChannel();
    newMessagePortRpcSession(
      port1 as unknown as MessagePort,
      new HaloRpc(workspace, pi, () => {
        throw new Error("dialog unused in this test");
      }),
    );
    using api = newMessagePortRpcSession<HaloRpc>(
      port2 as unknown as MessagePort,
    );

    const deltas: string[] = [];
    using session = api.createAgentSession(created.sessionId);
    await session.subscribe((event) => {
      deltas.push(event.text);
    });
    const prompted = await session.prompt("hi");
    expect(prompted).toBeUndefined();
    expect(deltas).toEqual(["Cap", "n"]);
  });

  test("workspace helpers round-trip over Cap'n Web", async () => {
    const workspace = await workspaceService();
    const pi = new PiService(workspace, streamingFactory());
    const info = workspace.getWorkspace();
    expect(info).not.toBeNull();

    const { port1, port2 } = new MessageChannel();
    newMessagePortRpcSession(
      port1 as unknown as MessagePort,
      new HaloRpc(workspace, pi, () => {
        throw new Error("dialog unused in this test");
      }),
    );
    using api = newMessagePortRpcSession<HaloRpc>(
      port2 as unknown as MessagePort,
    );

    await expect(api.getWorkspace()).resolves.toEqual(info);
    const sessions = await api.listSessions();
    expect(sessions).toEqual([]);
  });
});
