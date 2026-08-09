import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "errore";

export class FilesWriteError extends errore.createTaggedError({
  name: "FilesWriteError",
  message: "Failed to write $path",
}) {}

export async function writeFile(
  cwd: string,
  { path: filePath, content }: { path: string; content: string },
) {
  const absolutePath = path.resolve(cwd, filePath);
  const written = await fs
    .writeFile(absolutePath, content, "utf8")
    .catch((e) => new FilesWriteError({ path: filePath, cause: e }));
  if (written instanceof Error) return written;
  return { path: filePath };
}
