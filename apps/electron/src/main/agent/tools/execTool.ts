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

export function createExecTool(input: {
  runtime: ToolRuntime;
  runtimeDescription: string;
}): ToolDefinition {
  return {
    name: "exec",
    label: "Exec",
    description: input.runtimeDescription,
    promptSnippet:
      "Run JavaScript with the granted Halo tools and connected integrations listed in the exec description",
    promptGuidelines: [
      "Pass JavaScript in `js`; `tools` and `console` are in scope.",
      'Scoped discovery example: `const { items } = await tools.search({ namespace: "integration_slug", query: "operation in a few words", limit: 5 }); const match = items[0]; return { match, schema: match === undefined ? undefined : await tools.describe.tool({ path: match.path }) };`',
      "Search paths are canonical. Invocation example: `const result = await tools[path](args); if (!result.ok) return result; return result.data;`",
      "Discovery helpers return data directly. Runtime tools return `{ ok: true, data }` or `{ ok: false, error }`.",
      'Connection example when account identity matters: `await tools.executor.coreTools.connections.list({ integration: "integration_slug" })`.',
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
        input.runtime,
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
