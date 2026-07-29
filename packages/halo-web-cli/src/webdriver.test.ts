import { afterEach, describe, expect, test, vi } from "vitest";
import { remote } from "webdriverio";
import { execute, getStatus } from "./webdriver.js";

vi.mock("webdriverio", () => ({ remote: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getStatus", () => {
  test("returns the embedded server status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          value: { ready: true, message: "ready" },
        }),
      }),
    );

    await expect(getStatus()).resolves.toEqual({
      ready: true,
      message: "ready",
    });
  });
});

describe("execute", () => {
  test("runs a script with the browser and closes the session", async () => {
    const getTitle = vi.fn().mockResolvedValue("Halo");
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    vi.mocked(remote).mockResolvedValue({ getTitle, deleteSession } as never);

    await expect(execute("return await browser.getTitle()")).resolves.toBe(
      "Halo",
    );
    expect(getTitle).toHaveBeenCalledOnce();
    expect(deleteSession).toHaveBeenCalledOnce();
  });

  test("closes the session when the script fails", async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    vi.mocked(remote).mockResolvedValue({ deleteSession } as never);

    await expect(execute('throw new Error("failed")')).rejects.toThrow(
      "failed",
    );
    expect(deleteSession).toHaveBeenCalledOnce();
  });
});
