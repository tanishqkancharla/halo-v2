import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import {
  formatSkillsForSystemPrompt,
  type Skill,
} from "@earendil-works/pi-agent-core";
import * as errore from "errore";
import { haloSystemPrompt } from "./workspacePrompt.js";

class WorkspaceInstructionsError extends errore.createTaggedError({
  name: "WorkspaceInstructionsError",
  message: "Could not read workspace instructions at '$path'",
}) {}

export class WorkspaceResourceLoader {
  private skills: Skill[] = [];
  private instructions = "";
  constructor(private readonly workspaceRoot: string) {}

  async reload() {
    const loaded = loadSkillsFromDir({
      dir: join(this.workspaceRoot, ".agents", "skills"),
      source: "workspace",
    });
    const skills: Skill[] = [];
    for (const skill of loaded.skills) {
      const content = await readInstructions(skill.filePath);
      if (content instanceof Error) return content;
      skills.push({ ...skill, content });
    }
    this.skills = skills;
    this.instructions = "";
    const path = join(this.workspaceRoot, "AGENTS.md");
    if (!existsSync(path)) return;
    const content = await readInstructions(path);
    if (content instanceof Error) return content;
    this.instructions = `<project_context>\n<project_instructions path="${path}">\n${content}\n</project_instructions>\n</project_context>`;
  }

  getResources() {
    return { skills: this.skills };
  }
  getSystemPrompt() {
    return [
      haloSystemPrompt(this.workspaceRoot),
      this.instructions,
      formatSkillsForSystemPrompt(this.skills),
      `Current working directory: ${this.workspaceRoot}`,
    ].join("\n\n");
  }
}

function readInstructions(path: string) {
  return readFile(path, "utf8").catch(
    (cause) => new WorkspaceInstructionsError({ path, cause }),
  );
}
