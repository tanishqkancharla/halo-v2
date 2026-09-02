import type { CredentialVault } from "./agent/runtime/CredentialVault.js";
import type { FilesystemService } from "./filesystem/FilesystemService.js";

export type CredentialVaultInput = {
  filesystem: FilesystemService;
  workspaceRoot: string;
};

export interface ServerHost {
  createCredentialVault(input: CredentialVaultInput): CredentialVault;
}
