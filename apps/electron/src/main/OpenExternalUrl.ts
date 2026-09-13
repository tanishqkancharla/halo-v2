import { spawn } from "node:child_process";
import { shell } from "electron";
import * as errore from "errore";

export class OpenExternalUrlError extends errore.createTaggedError({
  name: "OpenExternalUrlError",
  message: "Halo could not open the URL",
}) {}

export async function openExternalUrl(url: string) {
  if (process.platform !== "linux") {
    return await shell
      .openExternal(url)
      .catch((cause) => new OpenExternalUrlError({ cause }));
  }

  // Electron's shell.openExternal runs xdg-open with inherited stdio, so the
  // browser child keeps Halo alive after the window closes.
  return errore.try({
    try: () => {
      const child = spawn("xdg-open", [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    },
    catch: (cause) => new OpenExternalUrlError({ cause }),
  });
}
