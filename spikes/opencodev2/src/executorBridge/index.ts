import { Plugin } from "@opencode/plugin";

export type ExecutorCall = {
  operation: string;
};

export const executorCalls: ExecutorCall[] = [];

const executorBridge = Plugin.define({
  id: "halo.executor.bridge",
  async setup(context) {
    await context.tool.transform((editor) => {
      editor.namespace({
        name: "halo",
        description: "Halo integration tools backed by Executor.",
      });
      editor.add({
        name: "integration",
        description: "Call a connected Halo integration through Executor.",
        input: {
          type: "object",
          properties: { operation: { type: "string" } },
          required: ["operation"],
          additionalProperties: false,
        },
        options: { namespace: "halo", codemode: true },
        async execute(input, tool) {
          // SAFETY: OpenCode validates tool input against the object schema above before execution.
          const call = input as ExecutorCall;
          executorCalls.push(call);
          await tool.progress({ phase: "executor.invoke" });
          return {
            content: JSON.stringify({ ok: true, operation: call.operation }),
            metadata: { backend: "executor" },
          };
        },
      });
    });
  },
});

export default executorBridge;
