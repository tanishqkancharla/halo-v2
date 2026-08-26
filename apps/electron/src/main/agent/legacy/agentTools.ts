import { runBash } from "../tools/bash/run.js";
import { deleteFile } from "../tools/files/delete.js";
import { editFile } from "../tools/files/edit.js";
import { patchFiles } from "../tools/files/patch.js";
import { readFile } from "../tools/files/read.js";
import { writeFile } from "../tools/files/write.js";

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
    patch(
      patchText: string,
    ): Promise<
      { added: string[]; modified: string[]; deleted: string[] } | Error
    >;
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
      read: (path, options) =>
        readFile(cwd, { path, offset: options?.offset, limit: options?.limit }),
      edit: (path, oldText, newText, options) =>
        editFile(cwd, {
          path,
          oldText,
          newText,
          replaceAll: options?.replaceAll,
        }),
      patch: (patchText) => patchFiles(cwd, { patchText }),
      write: (path, content) => writeFile(cwd, { path, content }),
      delete: (path) => deleteFile(cwd, { path }),
    },
    bash: {
      run: (command, options) =>
        runBash(cwd, {
          command,
          timeoutMs: options?.timeoutMs,
          signal,
        }),
    },
  };
}
