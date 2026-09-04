import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { formatExecuteResult } from "@executor-js/execution/core";
import { Type } from "typebox";
import {
  ConnectionRequiredError,
  type ToolRuntime,
} from "../runtime/ToolRuntime.js";

const execParameters = Type.Object({
  js: Type.String({ description: "JavaScript to run. tools is in scope." }),
});

export function createExecTool(input: {
  runtime: ToolRuntime;
  runtimeDescription: string;
}): ToolDefinition {
  return {
    name: "exec",
    label: "Exec",
    description: input.runtimeDescription,
    parameters: execParameters,
    async execute(id, params, signal, onUpdate, context) {
      // SAFETY: execParameters schema guarantees params has a string `js` property.
      const { js } = params as { js: string };
      const result = await input.runtime.executeCode({
        code: js,
        signal,
        modelId: context.model?.id,
        parentToolCallId: id,
        onToolEvent:
          onUpdate === undefined
            ? undefined
            : (event) => onUpdate({ content: [], details: event }),
      });
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
          isError: true,
        };
      }
      const formatted = formatExecuteResult(result);
      return {
        content: [{ type: "text" as const, text: formatted.text }],
        details: formatted.structured,
        isError: formatted.isError,
      };
    },
  };
}
