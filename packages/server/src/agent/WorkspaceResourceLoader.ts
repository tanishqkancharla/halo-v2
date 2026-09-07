import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createExtensionRuntime,
  loadSkillsFromDir,
  type LoadExtensionsResult,
  type LoadSkillsResult,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import * as errore from "errore";
import { haloSystemPrompt } from "./workspacePrompt.js";

class WorkspaceInstructionsError extends errore.createTaggedError({
  name: "WorkspaceInstructionsError",
  message: "Could not read workspace instructions at '$path'",
}) {}

export class WorkspaceResourceLoader implements ResourceLoader {
  private skills: LoadSkillsResult = { skills: [], diagnostics: [] };
  private agentsFiles: { path: string; content: string }[] = [];
  private readonly extensions: LoadExtensionsResult = {
    extensions: [],
    errors: [],
    runtime: createExtensionRuntime(),
  };

  constructor(private readonly workspaceRoot: string) {}

  async reload() {
    this.skills = loadSkillsFromDir({
      dir: join(this.workspaceRoot, ".agents", "skills"),
      source: "workspace",
    });
    this.agentsFiles = [];
    const path = join(this.workspaceRoot, "AGENTS.md");
    if (!existsSync(path)) return;
    const content = await readFile(path, "utf8").catch(
      (cause) => new WorkspaceInstructionsError({ path, cause }),
    );
    if (content instanceof Error) throw content;
    this.agentsFiles = [{ path, content }];
  }

  getSkills() {
    return this.skills;
  }
  getAgentsFiles() {
    return { agentsFiles: this.agentsFiles };
  }
  getSystemPrompt() {
    return haloSystemPrompt(this.workspaceRoot);
  }
  getExtensions() {
    return this.extensions;
  }
  getPrompts() {
    return { prompts: [], diagnostics: [] };
  }
  getThemes() {
    return { themes: [], diagnostics: [] };
  }
  getSystemPromptSource() {
    return undefined;
  }
  getAppendSystemPrompt() {
    return [];
  }
  getAppendSystemPromptSources() {
    return [];
  }
  extendResources() {
    // Halo does not load Pi extensions, so they cannot contribute resources.
  }
}
