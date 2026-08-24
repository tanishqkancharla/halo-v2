import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

function workspacePrompt(workspaceRoot: string) {
  const path = workspaceRoot.replaceAll("\\", "/");
  return `## Workspace

<working_directory>${path}</working_directory>

<working_directory_context>
The user explicitly selected this as the working directory for this session.
Stay in this folder. Do not list, read, search, or edit files outside it unless the user asks, or a skill they invoked names a specific file.
Do not browse parent directories, the home folder, or other projects for extra context.
Pi documentation paths in this prompt live outside the workspace. Open them only if the user asks about Pi.
</working_directory_context>`;
}

export function createWorkspaceResourceLoader(cwd: string, agentDir: string) {
  return new DefaultResourceLoader({
    cwd,
    agentDir,
    appendSystemPromptOverride: (base) => [...base, workspacePrompt(cwd)],
  });
}
