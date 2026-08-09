import * as errore from "errore";
import { applyPatch } from "./applyPatch.js";

export class FilesPatchError extends errore.createTaggedError({
  name: "FilesPatchError",
  message: "Failed to apply patch",
}) {}

export async function patchFiles(
  cwd: string,
  { patchText }: { patchText: string },
) {
  const preview = errore.try({
    try: () => applyPatch(patchText, cwd),
    catch: (e) => new FilesPatchError({ cause: e }),
  });
  if (preview instanceof Error) return preview;
  return { message: preview.message };
}
