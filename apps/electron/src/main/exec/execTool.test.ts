import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  SessionManager,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { describe, expect, test } from "vitest";
import { createExecTool } from "./execTool.js";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-exec-tool-${name}-`));
}

describe("createExecTool", () => {
  test("defines an exec tool with a js parameter", () => {
    const tool = createExecTool("/tmp");
    expect(tool.name).toBe("exec");
    expect(tool.parameters).toMatchObject({
      type: "object",
      required: ["js"],
    });
  });

  test("creates a session with only exec active", async () => {
    const root = await testDirectory("session");
    const agentDir = join(root, ".pi", "agent");
    await mkdir(join(agentDir, "sessions"), { recursive: true });

    const { session } = await createAgentSession({
      cwd: root,
      agentDir,
      sessionManager: SessionManager.inMemory(),
      tools: [],
      customTools: [createExecTool(root)],
    });

    expect(session.getActiveToolNames()).toEqual(["exec"]);
  });

  test("exec writes and reads a workspace file", async () => {
    const root = await testDirectory("execute");
    const tool = createExecTool(root);
    const ctx = {} as ExtensionContext;

    const result = await tool.execute(
      "1",
      {
        js: `await tools.files.write("x.txt", "ok"); return await tools.files.read("x.txt");`,
      },
      undefined,
      undefined,
      ctx,
    );

    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({ path: "x.txt", text: "ok" }, null, 2),
      },
    ]);
    expect(await readFile(join(root, "x.txt"), "utf8")).toBe("ok");
  });
});
