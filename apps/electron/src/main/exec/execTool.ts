import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as errore from "errore";
import { createAgentTools } from "./agentTools.js";
import { runJs } from "./runJs.js";

export class ExecToolError extends errore.createTaggedError({
  name: "ExecToolError",
  message: "exec failed",
}) {}

const execParameters = Type.Object({
  js: Type.String({ description: "JavaScript to run. tools is in scope." }),
});

function formatExecResult(value: unknown, logs: string[]) {
  const parts: string[] = [];
  if (logs.length > 0) {
    parts.push(logs.join("\n"));
  }
  if (value !== undefined) {
    parts.push(
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    );
  }
  if (parts.length === 0) return "(no output)";
  return parts.join("\n\n");
}

export function createExecTool(cwd: string): ToolDefinition {
  return {
    name: "exec",
    label: "Exec",
    description:
      "Run JavaScript with a tools argument. Use tools.files and tools.bash.run for all work.",
    promptSnippet: "Run JavaScript that calls tools.files.* and tools.bash.run",
    promptGuidelines: [
      "The only tool is exec. Pass JavaScript in js.",
      "Call await tools.files.read/edit/patch/write/delete and await tools.bash.run.",
      "Return or console.log the important result.",
    ],
    parameters: execParameters,
    async execute(_id, params, signal) {
      const { js } = params as { js: string };
      const tools = createAgentTools(cwd, signal);
      const result = await runJs(js, tools).catch(
        (e) => new ExecToolError({ cause: e }),
      );
      if (result instanceof Error) {
        return {
          content: [{ type: "text" as const, text: result.message }],
          details: { error: result.message },
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: formatExecResult(result.value, result.logs),
          },
        ],
        details: { value: result.value, logs: result.logs },
      };
    },
  };
}
