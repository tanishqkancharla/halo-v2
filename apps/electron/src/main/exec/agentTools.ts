import { runBash } from "./bash/run.js";
import { deleteFile } from "./files/delete.js";
import { editFile } from "./files/edit.js";
import { patchFiles } from "./files/patch.js";
import { readFile } from "./files/read.js";
import { writeFile } from "./files/write.js";

export type AgentTools = {
  files: {
    read(
      path: string,
      options?: { offset?: number; limit?: number },
    ): Promise<{ path: string; text: string } | Error>;
    edit(
      path: string,
      oldText: string,
      newText: string,
      options?: { replaceAll?: boolean },
    ): Promise<{ path: string; replacements: number } | Error>;
    patch(patchText: string): Promise<{ message: string } | Error>;
    write(path: string, content: string): Promise<{ path: string } | Error>;
    delete(path: string): Promise<{ path: string } | Error>;
  };
  bash: {
    run(
      command: string,
      options?: { timeoutMs?: number },
    ): Promise<{ stdout: string; stderr: string; code: number | null } | Error>;
  };
};

export function createAgentTools(
  cwd: string,
  signal?: AbortSignal,
): AgentTools {
  return {
    files: {
      read: (filePath, options) => readFile(cwd, filePath, options),
      edit: (filePath, oldText, newText, options) =>
        editFile(cwd, filePath, oldText, newText, options),
      patch: (patchText) => patchFiles(cwd, patchText),
      write: (filePath, content) => writeFile(cwd, filePath, content),
      delete: (filePath) => deleteFile(cwd, filePath),
    },
    bash: {
      run: (command, options) => runBash(cwd, command, options, signal),
    },
  };
}
