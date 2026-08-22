import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createWorkspaceResourceLoader,
  workspacePrompt,
} from "./workspacePrompt.js";

describe("workspacePrompt", () => {
  test("names the chosen folder and tells the agent to stay in it", () => {
    const prompt = workspacePrompt("/home/ubuntu/halo-workspace");

    expect(prompt).toContain(
      "<working_directory>/home/ubuntu/halo-workspace</working_directory>",
    );
    expect(prompt).toContain(
      "The user explicitly selected this as the working directory for this session.",
    );
    expect(prompt).toContain(
      "Do not list, read, search, or edit files outside it unless the user asks",
    );
    expect(prompt).toContain(
      "Do not browse parent directories, the home folder, or other projects for extra context.",
    );
  });
});

describe("createWorkspaceResourceLoader", () => {
  test("appends workspace instructions to Pi's system prompt", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "halo-workspace-prompt-"));
    const agentDir = join(cwd, ".pi", "agent");
    const loader = createWorkspaceResourceLoader(cwd, agentDir);
    await loader.reload();

    expect(loader.getAppendSystemPrompt()).toEqual([workspacePrompt(cwd)]);
  });
});
