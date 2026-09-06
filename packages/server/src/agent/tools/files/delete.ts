import * as errore from "errore";
import type { FilesystemService } from "../../../filesystem/FilesystemService.js";
import {
  FilesInvalidPathError,
  resolveInsideWorkspace,
} from "./workspacePath.js";

export class FilesDeleteError extends errore.createTaggedError({
  name: "FilesDeleteError",
  message: "Failed to delete $path",
}) {}

export async function deleteFile(args: {
  filesystem: FilesystemService;
  cwd: string;
  input: { path: string };
}) {
  const resolved = resolveInsideWorkspace(args.cwd, args.input.path);
  if (resolved instanceof FilesInvalidPathError) return resolved;
  const removed = await args.filesystem.unlink(resolved.absolutePath);
  if (removed instanceof Error) {
    return new FilesDeleteError({ path: args.input.path, cause: removed });
  }
  return { path: args.input.path };
}
