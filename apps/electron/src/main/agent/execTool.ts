import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as errore from "errore";
import type { ToolRuntime } from "./executor/ToolRuntime.js";

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

export function createExecTool(runtime: ToolRuntime): ToolDefinition {
  return {
    name: "exec",
    label: "Exec",
    description:
      "Run JavaScript through Executor with read-only workspace file access.",
    promptSnippet: "Run JavaScript that calls tools.files.read",
    promptGuidelines: [
      "Use exec for read-only workspace file work. Pass JavaScript in js; tools and console are in scope.",
      "`tools.files.read(path: string)` returns `{ ok: true, data: { path: string, text: string } }` or `{ ok: false, error: unknown }`.",
      'File example: `const file = await tools.files.read("src/app.ts"); if (!file.ok) return file; return file.data.text;`',
      "Combine related reads in one exec call when practical. Return only the compact result needed to continue.",
    ],
    parameters: execParameters,
    async execute(_id, params) {
      // SAFETY: execParameters schema guarantees params has a string `js` property.
      const { js } = params as { js: string };
      const result = await runWithToolRuntime(runtime, js);
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

async function runWithToolRuntime(runtime: ToolRuntime, js: string) {
  const execution = await runtime.executeCode({ code: js });
  if (execution instanceof Error) return execution;
  if (execution.error !== undefined) {
    return new ExecToolError({ cause: new Error(execution.error) });
  }
  if (execution.value === undefined) {
    return { value: undefined, logs: execution.logs };
  }
  return {
    value: JSON.stringify(execution.value, undefined, 2),
    logs: execution.logs,
  };
}
