import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { safeStorage } from "electron";
import * as errore from "errore";
import {
  type CredentialVault,
  CredentialVaultError,
} from "./CredentialVault.js";

class EncryptedFileCredentialVault implements CredentialVault {
  constructor(private readonly directory: string) {}

  async get(id: string) {
    const encrypted = await fs
      .readFile(this.filePath(id))
      .catch((cause) => new CredentialVaultError({ operation: "read", cause }));
    if (encrypted instanceof Error && isMissingFile(encrypted.cause)) {
      return undefined;
    }
    if (encrypted instanceof Error) return encrypted;

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

    const created = await fs
      .mkdir(this.directory, { recursive: true, mode: 0o700 })
      .catch(
        (cause) =>
          new CredentialVaultError({ operation: "create directory", cause }),
      );
    if (created instanceof Error) return created;

    const written = await fs
      .writeFile(this.filePath(id), encrypted, { mode: 0o600 })
      .catch(
        (cause) => new CredentialVaultError({ operation: "write", cause }),
      );
    if (written instanceof Error) return written;
  }

  async delete(id: string) {
    const removed = await fs
      .rm(this.filePath(id), { force: true })
      .catch(
        (cause) => new CredentialVaultError({ operation: "delete", cause }),
      );
    if (removed instanceof Error) return removed;
  }

  private filePath(id: string) {
    const name = crypto.createHash("sha256").update(id).digest("hex");
    return path.join(this.directory, name);
  }
}

export function createEncryptedFileCredentialVault(input: {
  workspaceRoot: string;
}): CredentialVault {
  return new EncryptedFileCredentialVault(
    path.join(input.workspaceRoot, ".halo", "executor", "credentials"),
  );
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

function isMissingFile(cause: unknown) {
  return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
}
