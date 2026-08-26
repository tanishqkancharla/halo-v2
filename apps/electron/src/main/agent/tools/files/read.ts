import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "errore";

export class FilesReadError extends errore.createTaggedError({
  name: "FilesReadError",
  message: "Failed to read $path",
}) {}

export async function readFile(
  cwd: string,
  {
    path: filePath,
    offset,
    limit,
  }: {
    path: string;
    offset?: number;
    limit?: number;
  },
) {
  const absolutePath = path.resolve(cwd, filePath);
  const raw = await fs
    .readFile(absolutePath, "utf8")
    .catch((e) => new FilesReadError({ path: filePath, cause: e }));
  if (raw instanceof Error) return raw;

  if (offset === undefined && limit === undefined) {
    return { path: filePath, text: raw };
  }

  const lines = raw.split("\n");
  const startLine = offset === undefined ? 0 : Math.max(0, offset - 1);
  if (startLine >= lines.length) {
    return new FilesReadError({
      path: filePath,
      cause: new Error(
        `Offset ${offset} is beyond end of file (${lines.length} lines total)`,
      ),
    });
  }

  const endLine =
    limit === undefined
      ? lines.length
      : Math.min(startLine + limit, lines.length);
  return { path: filePath, text: lines.slice(startLine, endLine).join("\n") };
}
