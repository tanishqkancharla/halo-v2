import path from "node:path";
import * as errore from "errore";
import { toPosixRelative } from "../../../workspace/WorkspaceService.js";

export class FilesInvalidPathError extends errore.createTaggedError({
  name: "FilesInvalidPathError",
  message: "'$path' is not a workspace file.",
}) {}

/**
 * Resolves `inputPath` against `cwd` and confines the result to `cwd`.
 *
 * Returns the contained absolute path, or a `FilesInvalidPathError` when
 * `inputPath` escapes the workspace — a `../` traversal or an absolute path
 * whose resolved location is outside `cwd`. Only a clean workspace-relative
 * path is accepted. This enforces the agent file tools' own documented scope
 * ("a workspace file") at the only layer that touches the filesystem, and
 * matches the containment check already used by the parallel RPC layer in
 * `WorkspaceService`.
 *
 * `WorkspaceService` additionally rejects dotfiles and `node_modules` via
 * `isSkippedRelativePath`. The agent tools deliberately do not: an agent may
 * legitimately edit workspace dotfiles such as `.gitignore` and `.env.example`,
 * and an agent granted `workspace.shell.execute` can already touch them via
 * the unsandboxed bash tool — blocking the file tools from doing so would
 * simply shift the same reach to bash. The containment check (no escape
 * outside the workspace) is enforced regardless.
 */
export function resolveInsideWorkspace(
  cwd: string,
  inputPath: string,
): FilesInvalidPathError | { absolutePath: string } {
  const absolutePath = path.resolve(cwd, inputPath);
  const relativePath = toPosixRelative(cwd, absolutePath);
  if (relativePath !== inputPath) {
    return new FilesInvalidPathError({ path: inputPath });
  }
  return { absolutePath };
}
