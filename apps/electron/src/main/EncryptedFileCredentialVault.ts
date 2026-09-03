import crypto from "node:crypto";
import path from "node:path";
import { safeStorage } from "electron";
import * as errore from "errore";
import {
  type CredentialVault,
  CredentialVaultError,
} from "@get-halo/server/agent";
import {
  type FilesystemService,
  FilesystemPathNotFoundError,
} from "@get-halo/server/filesystem";

class EncryptedFileCredentialVault implements CredentialVault {
  private readonly filesystem: FilesystemService;
  private readonly directory: string;

  constructor(options: { filesystem: FilesystemService; directory: string }) {
    this.filesystem = options.filesystem;
    this.directory = options.directory;
  }

  async get(id: string) {
    const encrypted = await this.filesystem.readFile(this.filePath(id));
    if (encrypted instanceof FilesystemPathNotFoundError) return undefined;
    if (encrypted instanceof Error) {
      return new CredentialVaultError({ operation: "read", cause: encrypted });
    }

    const available = encryptionAvailable();
    if (available instanceof Error) return available;
    return errore.try({
      try: () => safeStorage.decryptString(encrypted),
      catch: (cause) =>
        new CredentialVaultError({ operation: "decrypt", cause }),
    });
  }

  async set(id: string, value: string) {
    const available = encryptionAvailable();
    if (available instanceof Error) return available;
    const encrypted = errore.try({
      try: () => safeStorage.encryptString(value),
      catch: (cause) =>
        new CredentialVaultError({ operation: "encrypt", cause }),
    });
    if (encrypted instanceof Error) return encrypted;

    const created = await this.filesystem.makeDirectory(this.directory, {
      recursive: true,
      mode: 0o700,
    });
    if (created instanceof Error) {
      return new CredentialVaultError({
        operation: "create directory",
        cause: created,
      });
    }

    const written = await this.filesystem.writeFile(
      this.filePath(id),
      encrypted,
      { mode: 0o600 },
    );
    if (written instanceof Error) {
      return new CredentialVaultError({ operation: "write", cause: written });
    }
  }

  async delete(id: string) {
    const removed = await this.filesystem.remove(this.filePath(id), {
      force: true,
    });
    if (removed instanceof Error) {
      return new CredentialVaultError({ operation: "delete", cause: removed });
    }
  }

  private filePath(id: string) {
    const name = crypto.createHash("sha256").update(id).digest("hex");
    return path.join(this.directory, name);
  }
}

export function createEncryptedFileCredentialVault(input: {
  filesystem: FilesystemService;
  workspaceRoot: string;
}): CredentialVault {
  return new EncryptedFileCredentialVault({
    filesystem: input.filesystem,
    directory: path.join(
      input.workspaceRoot,
      ".halo",
      "executor",
      "credentials",
    ),
  });
}

function encryptionAvailable() {
  if (safeStorage === undefined || !safeStorage.isEncryptionAvailable()) {
    return new CredentialVaultError({
      operation: "initialization",
      cause: new Error("Secure operating-system encryption is unavailable."),
    });
  }
  if (
    process.platform === "linux" &&
    safeStorage.getSelectedStorageBackend() === "basic_text"
  ) {
    return new CredentialVaultError({
      operation: "initialization",
      cause: new Error("Electron selected the insecure basic_text backend."),
    });
  }
}
