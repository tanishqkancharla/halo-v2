import type { ServerHost } from "@get-halo/server/host";
import type { CredentialVaultInput } from "@get-halo/server/host";
import { createEncryptedFileCredentialVault } from "./agent/runtime/EncryptedFileCredentialVault.js";

export class ElectronServerHost implements ServerHost {
  createCredentialVault(input: CredentialVaultInput) {
    return createEncryptedFileCredentialVault(input);
  }
}
