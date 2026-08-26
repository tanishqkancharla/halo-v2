import { Type } from "@sinclair/typebox";
import {
  defineHaloTool,
  type HaloToolPluginFactory,
} from "../HaloToolPlugin.js";
import { runBash } from "./run.js";

const runInput = Type.Object({
  command: Type.String(),
  timeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
});

export const createWorkspaceBashPlugin: HaloToolPluginFactory = ({
  workspaceRoot,
}) => ({
  id: "bash",
  name: "Workspace shell",
  tools: [
    defineHaloTool({
      name: "run",
      description: "Run a Bash command in the active Halo workspace.",
      inputSchema: runInput,
      requiredCapabilities: ["workspace.shell.execute"],
      execute: async (input, context) => {
        const result = await runBash(workspaceRoot, {
          ...input,
          signal: context.signal,
        });
        if (result instanceof Error) return result;
        return { value: result };
      },
    }),
  ],
});
