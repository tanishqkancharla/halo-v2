import * as errore from "errore";
import type { FilesystemService } from "../../../filesystem/FilesystemService.js";
import {
  FilesInvalidPathError,
  resolveInsideWorkspace,
} from "./workspacePath.js";

export class FilesWriteError extends errore.createTaggedError({
  name: "FilesWriteError",
  message: "Failed to write $path",
}) {}

export async function writeFile(args: {
  filesystem: FilesystemService;
  cwd: string;
  input: { path: string; content: string };
}) {
  const resolved = resolveInsideWorkspace(args.cwd, args.input.path);
  if (resolved instanceof FilesInvalidPathError) return resolved;
  const written = await args.filesystem.writeFile(
    resolved.absolutePath,
    args.input.content,
    "utf8",
  );
  if (written instanceof Error) {
    return new FilesWriteError({ path: args.input.path, cause: written });
  }
  return { path: args.input.path };
}
