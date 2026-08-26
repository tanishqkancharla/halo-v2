import { Type } from "@sinclair/typebox";
import {
  defineHaloTool,
  type HaloToolExecution,
  type HaloToolPluginFactory,
} from "../HaloToolPlugin.js";
import { deleteFile } from "./delete.js";
import { editFile } from "./edit.js";
import { patchFiles } from "./patch.js";
import { readFile } from "./read.js";
import { writeFile } from "./write.js";

const readInput = Type.Object({
  path: Type.String(),
  offset: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});

const editInput = Type.Object({
  path: Type.String(),
  oldText: Type.String(),
  newText: Type.String(),
  replaceAll: Type.Optional(Type.Boolean()),
});

const patchInput = Type.Object({
  patchText: Type.String(),
});

const writeInput = Type.Object({
  path: Type.String(),
  content: Type.String(),
});

const deleteInput = Type.Object({
  path: Type.String(),
});

export const createWorkspaceFilesPlugin: HaloToolPluginFactory = ({
  workspaceRoot,
}) => ({
  id: "files",
  name: "Workspace files",
  tools: [
    defineHaloTool({
      name: "read",
      description: "Read a UTF-8 file in the active Halo workspace.",
      inputSchema: readInput,
      requiredCapabilities: ["workspace.files.read"],
      execute: (input) => execution(readFile(workspaceRoot, input)),
    }),
    defineHaloTool({
      name: "edit",
      description: "Replace exact text in a workspace file.",
      inputSchema: editInput,
      requiredCapabilities: ["workspace.files.write"],
      execute: (input) => execution(editFile(workspaceRoot, input)),
    }),
    defineHaloTool({
      name: "patch",
      description: "Apply a patch to workspace files.",
      inputSchema: patchInput,
      requiredCapabilities: ["workspace.files.write"],
      execute: (input) => execution(patchFiles(workspaceRoot, input)),
    }),
    defineHaloTool({
      name: "write",
      description: "Write a UTF-8 workspace file.",
      inputSchema: writeInput,
      requiredCapabilities: ["workspace.files.write"],
      execute: (input) => execution(writeFile(workspaceRoot, input)),
    }),
    defineHaloTool({
      name: "delete",
      description: "Delete a workspace file.",
      inputSchema: deleteInput,
      requiredCapabilities: ["workspace.files.write"],
      execute: (input) => execution(deleteFile(workspaceRoot, input)),
    }),
  ],
});

async function execution<T>(resultPromise: Promise<T | Error>) {
  const result = await resultPromise;
  if (result instanceof Error) return result;
  return { value: result } satisfies HaloToolExecution;
}
