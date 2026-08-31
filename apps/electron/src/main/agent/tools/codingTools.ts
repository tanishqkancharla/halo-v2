import {
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
} from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type TSchema, Type } from "@sinclair/typebox";
import type { AgentAuthority } from "../runtime/AgentAuthority.js";
import { patchFiles } from "./files/patch.js";

const patchParameters = Type.Object({
  patchText: Type.String({ description: "Patch in apply_patch format." }),
});

type Authorization = {
  pluginId: string;
  toolName: string;
  requiredCapabilities: readonly string[];
};

export function createAuthorizedCodingTools(input: {
  cwd: string;
  authority: AgentAuthority;
}) {
  return [
    withAuthority(
      createReadTool(input.cwd),
      input.authority,
      authorization("files", "read", "workspace.files.read"),
    ),
    withAuthority(
      createEditTool(input.cwd),
      input.authority,
      authorization("files", "edit", "workspace.files.write"),
    ),
    withAuthority(
      createWriteTool(input.cwd),
      input.authority,
      authorization("files", "write", "workspace.files.write"),
    ),
    withAuthority(
      createPatchTool(input.cwd),
      input.authority,
      authorization("files", "patch", "workspace.files.write"),
    ),
    withAuthority(
      createBashTool(input.cwd),
      input.authority,
      authorization("bash", "run", "workspace.shell.execute"),
    ),
  ] as const;
}

function authorization(
  pluginId: string,
  toolName: string,
  capability: string,
): Authorization {
  return { pluginId, toolName, requiredCapabilities: [capability] };
}

function withAuthority<TParameters extends TSchema, TDetails>(
  tool: AgentTool<TParameters, TDetails>,
  authority: AgentAuthority,
  toolAuthorization: Authorization,
): AgentTool<TParameters, TDetails> {
  return {
    ...tool,
    async execute(id, params, signal, onUpdate) {
      await authorize(authority, toolAuthorization);
      return tool.execute(id, params, signal, onUpdate);
    },
  };
}

function createPatchTool(
  cwd: string,
): AgentTool<
  typeof patchParameters,
  { added: string[]; modified: string[]; deleted: string[] }
> {
  return {
    name: "patch",
    label: "Patch",
    description: "Apply an apply_patch patch to files in the active workspace.",
    parameters: patchParameters,
    async execute(_id, params) {
      const result = await patchFiles(cwd, params);
      if (result instanceof Error) throw result;
      return {
        content: [{ type: "text", text: JSON.stringify(result, undefined, 2) }],
        details: result,
      };
    },
  };
}

async function authorize(
  authority: AgentAuthority,
  toolAuthorization: Authorization,
) {
  const denied = await authority.authorize(toolAuthorization);
  // Pi reports rejected tool promises as failed tool calls.
  if (denied instanceof Error) throw denied;
}
