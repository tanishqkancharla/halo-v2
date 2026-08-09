import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "errore";

export class FilesDeleteError extends errore.createTaggedError({
  name: "FilesDeleteError",
  message: "Failed to delete $path",
}) {}

export async function deleteFile(cwd: string, filePath: string) {
  const absolutePath = path.resolve(cwd, filePath);
  const removed = await fs
    .unlink(absolutePath)
    .catch((e) => new FilesDeleteError({ path: filePath, cause: e }));
  if (removed instanceof Error) return removed;
  return { path: filePath };
}
