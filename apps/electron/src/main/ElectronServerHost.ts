import { dialog, shell, type BrowserWindow } from "electron";
import type { ServerHost } from "@get-halo/server/host";
import type { CredentialVaultInput } from "@get-halo/server/host";
import * as errore from "errore";
import { getAppInfo, installAppUpdate } from "./app/AppUpdate.js";
import { createEncryptedFileCredentialVault } from "./agent/runtime/EncryptedFileCredentialVault.js";

class ElectronServerHostError extends errore.createTaggedError({
  name: "ElectronServerHostError",
  message: "Electron host failed during $operation",
}) {}

export class ElectronServerHost implements ServerHost {
  constructor(private readonly getWindow: () => BrowserWindow) {}

  getAppInfo() {
    return getAppInfo();
  }

  installAppUpdate() {
    return installAppUpdate();
  }

  async chooseWorkspace() {
    const selection = await dialog
      .showOpenDialog(this.getWindow(), {
        title: "Choose a Halo workspace",
        buttonLabel: "Choose workspace",
        properties: ["openDirectory"],
      })
      .catch(
        (cause) =>
          new ElectronServerHostError({
            operation: "workspace selection",
            cause,
          }),
      );
    if (selection instanceof Error) return selection;
    if (selection.canceled) return undefined;
    return selection.filePaths[0];
  }

  async openExternal(url: string) {
    const opened = await shell.openExternal(url).catch(
      (cause) =>
        new ElectronServerHostError({
          operation: "opening an external URL",
          cause,
        }),
    );
    if (opened instanceof Error) return opened;
  }

  createCredentialVault(input: CredentialVaultInput) {
    return createEncryptedFileCredentialVault(input);
  }
}
