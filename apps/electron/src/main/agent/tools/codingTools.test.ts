import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import {
  AgentCapabilityDeniedError,
  StaticAgentAuthority,
} from "../runtime/AgentAuthority.js";
import { createAuthorizedCodingTools } from "./codingTools.js";

const codingToolTest = test.extend<{ workspaceRoot: string }>({
  workspaceRoot: async ({ task }, use) => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), `halo-coding-tools-${task.id}-`),
    );
    await use(workspaceRoot);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  },
});

codingToolTest("checks authority before reading", async ({ workspaceRoot }) => {
  await fs.writeFile(path.join(workspaceRoot, "secret.txt"), "secret");
  const tools = createAuthorizedCodingTools({
    cwd: workspaceRoot,
    authority: new StaticAgentAuthority([]),
  });
  const read = tools[0];
  expect(read.name).toBe("read");

  await expect(
    read.execute("read", { path: "secret.txt" }, undefined, undefined),
  ).rejects.toBeInstanceOf(AgentCapabilityDeniedError);
});

codingToolTest(
  "applies patches with write authority",
  async ({ workspaceRoot }) => {
    await fs.writeFile(path.join(workspaceRoot, "message.txt"), "before\n");
    const tools = createAuthorizedCodingTools({
      cwd: workspaceRoot,
      authority: new StaticAgentAuthority(["workspace.files.write"]),
    });
    const patch = tools[3];
    expect(patch.name).toBe("patch");

    await patch.execute(
      "patch",
      {
        patchText: `*** Begin Patch
*** Update File: message.txt
@@
-before
+after
*** End Patch`,
      },
      undefined,
      undefined,
    );

    await expect(
      fs.readFile(path.join(workspaceRoot, "message.txt"), "utf8"),
    ).resolves.toBe("after\n");
  },
);
