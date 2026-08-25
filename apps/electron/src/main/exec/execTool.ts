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

function formatExecResult(value: string | undefined, logs: string[]) {
  const parts: string[] = [];
  if (logs.length > 0) {
    parts.push(logs.join("\n"));
  }
  if (value !== undefined) {
    parts.push(value);
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
      "Use exec for all workspace file and shell work. Pass JavaScript in js; tools and console are in scope.",
      "All methods are async and return Error on failure. Check `result instanceof Error` and return the error before using a successful result.",
      "`tools.files.read(path: string, options?: { offset?: number; limit?: number }): { path: string; text: string } | Error`.",
      "`tools.files.edit(path: string, oldText: string, newText: string, options?: { replaceAll?: boolean }): { path: string; replacements: number } | Error`.",
      "`tools.files.patch(patchText: string): { added: string[]; modified: string[]; deleted: string[] } | Error`.",
      "`tools.files.write(path: string, content: string): { path: string } | Error`.",
      "`tools.files.delete(path: string): { path: string } | Error`.",
      "`tools.bash.run(command: string, options?: { timeoutMs?: number }): { stdout: string; stderr: string; code: number | null } | Error`.",
      "Combine related operations in one exec call when practical. Return a compact result needed to continue; do not return large file contents or raw error objects unless needed.",
      'File example: `const file = await tools.files.read("src/app.ts"); if (file instanceof Error) return file; return file.text;`',
      'Shell example: `const result = await tools.bash.run("git status --short && git diff --stat"); if (result instanceof Error) return result; return result.stdout;`',
    ],
    parameters: execParameters,
    async execute(_id, params, signal) {
      // SAFETY: execParameters schema guarantees params has a string `js` property.
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
