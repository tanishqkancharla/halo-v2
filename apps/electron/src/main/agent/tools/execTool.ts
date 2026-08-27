import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  ConnectionRequiredError,
  type ToolRuntime,
} from "../runtime/ToolRuntime.js";

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
      "Run JavaScript with workspace, shell, web, and integration tools.",
    promptSnippet:
      "Run JavaScript that calls tools.files.*, tools.bash.run, tools.web.*, and discovered integrations",
    promptGuidelines: [
      "Use exec for workspace file and shell work. Pass JavaScript in js; tools and console are in scope.",
      "Runtime tools take one object argument and return `{ ok: true, data }` or `{ ok: false, error }`. Check `ok` before using `data`.",
      "Use `tools.search({ query, limit? })` and `tools.describe.tool({ path })` to discover unfamiliar tools. These discovery helpers return their data directly, without an `ok` wrapper. Invoke a discovered path with `tools[path](args)`.",
      "Use `tools.executor.coreTools.integrations.list({})` to list available integrations and `tools.executor.coreTools.connections.list({ integration?, owner?, verbose? })` to list connected accounts.",
      "`tools.files.read({ path, offset?, limit? })` reads UTF-8 text.",
      "`tools.files.edit({ path, oldText, newText, replaceAll? })` replaces exact text.",
      "`tools.files.patch({ patchText })` applies a patch.",
      "`tools.files.write({ path, content })` writes UTF-8 text.",
      "`tools.files.delete({ path })` deletes a file.",
      "`tools.bash.run({ command, timeoutMs? })` runs Bash in the workspace and returns `{ stdout, stderr, code }`.",
      "`tools.web.search({ objective, search_queries })` searches the live web. Search excerpts are usually enough to answer.",
      "`tools.web.fetch({ urls, objective?, search_queries?, full_content? })` extracts content from known URLs when search excerpts are insufficient.",
      'File example: `const file = await tools.files.read({ path: "src/app.ts" }); if (!file.ok) return file; return file.data.text;`',
      "Combine related operations in one exec call when practical. Return only the compact result needed to continue.",
    ],
    parameters: execParameters,
    async execute(_id, params, signal, _onUpdate, context) {
      // SAFETY: execParameters schema guarantees params has a string `js` property.
      const { js } = params as { js: string };
      const result = await runWithToolRuntime(
        runtime,
        js,
        signal,
        context.model?.id,
      );
      if (result instanceof ConnectionRequiredError) {
        return {
          content: [{ type: "text" as const, text: result.message }],
          details: {
            error: result.message,
            connectionRequests: result.connectionRequests,
          },
        };
      }
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
        details: {
          value: result.value,
          logs: result.logs,
        },
      };
    },
  };
}

async function runWithToolRuntime(
  runtime: ToolRuntime,
  js: string,
  signal: AbortSignal | undefined,
  modelId: string | undefined,
) {
  const execution = await runtime.executeCode({ code: js, signal, modelId });
  if (execution instanceof Error) return execution;
  if (execution.value === undefined) {
    return {
      value: undefined,
      logs: execution.logs,
    };
  }
  return {
    value: JSON.stringify(execution.value, undefined, 2),
    logs: execution.logs,
  };
}
