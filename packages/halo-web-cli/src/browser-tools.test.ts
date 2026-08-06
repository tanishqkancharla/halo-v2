import { afterEach, describe, expect, test, vi } from "vitest";
import { createBrowserTools } from "libretto-browser-tools";
import { execute, getStatus, snapshot } from "./browser-tools.js";

vi.mock("libretto-browser-tools", () => ({
  createBrowserTools: vi.fn(),
  LocalBrowserProvider: class {
    readonly name = "local";
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockToolkit() {
  const browser_connect = {
    execute: vi.fn().mockResolvedValue({ ok: true, sessionId: "halo" }),
  };
  const browser_status = {
    execute: vi.fn().mockResolvedValue({ ok: true, pages: [] }),
  };
  const browser_exec = {
    execute: vi.fn().mockResolvedValue({
      ok: true,
      result: "Halo",
      snapshotDiff: "",
      stderr: "",
      stdout: "",
    }),
  };
  const browser_snapshot = {
    execute: vi.fn().mockResolvedValue({ ok: true, tree: "- document" }),
  };
  const dispose = vi.fn().mockResolvedValue(undefined);
  vi.mocked(createBrowserTools).mockReturnValue({
    dispose,
    tools: {
      browser_connect,
      browser_exec,
      browser_snapshot,
      browser_status,
    },
  } as never);

  return {
    browser_connect,
    browser_exec,
    browser_snapshot,
    browser_status,
    dispose,
  };
}

function mockDebugger() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        webSocketDebuggerUrl: "ws://127.0.0.1:4445/devtools/browser/halo",
      }),
    }),
  );
}

describe("getStatus", () => {
  test("connects to Halo and checks the browser session", async () => {
    mockDebugger();
    const toolkit = mockToolkit();

    await expect(getStatus()).resolves.toEqual({
      message: "ready",
      ready: true,
    });
    expect(toolkit.browser_status.execute).toHaveBeenCalledWith({
      sessionId: "halo",
    });
    expect(toolkit.dispose).toHaveBeenCalledOnce();
  });
});

describe("execute", () => {
  test("runs code through Browser Tools and detaches", async () => {
    mockDebugger();
    const toolkit = mockToolkit();

    await expect(execute("return await page.title()")).resolves.toMatchObject({
      result: "Halo",
    });
    expect(toolkit.browser_exec.execute).toHaveBeenCalledWith({
      code: "return await page.title()",
      sessionId: "halo",
    });
    expect(toolkit.dispose).toHaveBeenCalledOnce();
  });
});

describe("snapshot", () => {
  test("captures the accessibility tree", async () => {
    mockDebugger();
    const toolkit = mockToolkit();

    await expect(snapshot(false)).resolves.toEqual({ tree: "- document" });
    expect(toolkit.browser_snapshot.execute).toHaveBeenCalledWith({
      screenshot: false,
      sessionId: "halo",
    });
    expect(toolkit.dispose).toHaveBeenCalledOnce();
  });
});
