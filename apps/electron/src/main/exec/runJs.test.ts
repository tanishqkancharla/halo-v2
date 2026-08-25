import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createAgentTools } from "./agentTools.js";
import { runJs } from "./runJs.js";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-exec-runjs-${name}-`));
}

describe("runJs", () => {
  test("reads a file through tools", async () => {
    const cwd = await testDirectory("read");
    const tools = createAgentTools(cwd);
    const written = await tools.files.write("a.txt", "hi");
    expect(written).not.toBeInstanceOf(Error);

    const result = await runJs(
      `return await tools.files.read("a.txt");`,
      tools,
    );
    expect(result.value).toBe(
      JSON.stringify({ path: "a.txt", text: "hi" }, undefined, 2),
    );
    expect(result.logs).toEqual([]);
  });

  test("captures console.log and returned values", async () => {
    const cwd = await testDirectory("log");
    const tools = createAgentTools(cwd);

    const result = await runJs(`console.log("hi"); return 1;`, tools);
    expect(result.value).toBe("1");
    expect(result.logs).toEqual(["hi"]);
  });

  test("returns only the message from an error value", async () => {
    const cwd = await testDirectory("error-value");
    const tools = createAgentTools(cwd);

    const result = await runJs(
      `return await tools.files.read("missing.txt");`,
      tools,
    );
    expect(result.value).toBe("Failed to read missing.txt");
    expect(result.logs).toEqual([]);
  });

  test("surfaces thrown errors from model JS", async () => {
    const cwd = await testDirectory("throw");
    const tools = createAgentTools(cwd);

    await expect(runJs(`throw new Error("boom");`, tools)).rejects.toThrow(
      "boom",
    );
  });
});
