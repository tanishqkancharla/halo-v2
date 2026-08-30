import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { createWorkspaceResourceLoader } from "./workspacePrompt.js";

const skillPromptTest = test.extend<{ workspaceRoot: string }>({
  workspaceRoot: async ({ task }, use) => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), `halo-skills-${task.id}-`),
    );
    await use(workspaceRoot);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  },
});

skillPromptTest(
  "advertises discovered skills through exec",
  async ({ workspaceRoot }) => {
    const agentDir = path.join(workspaceRoot, ".pi", "agent");
    const skillFile = path.join(agentDir, "skills", "calendar", "SKILL.md");
    await fs.mkdir(path.dirname(skillFile), { recursive: true });
    await fs.writeFile(
      skillFile,
      `---
name: calendar
description: Work with calendars.
---

# Calendar
`,
    );

    const loader = createWorkspaceResourceLoader(workspaceRoot, agentDir);
    await loader.reload();
    const prompt = loader.getAppendSystemPrompt().join("\n\n");

    expect(prompt).toContain("<available_skills>");
    expect(prompt).toContain("<name>calendar</name>");
    expect(prompt).toContain(skillFile);
    expect(prompt).toContain(
      'tools.files.read({ path: "<location from the skill catalog>" })',
    );
  },
);
