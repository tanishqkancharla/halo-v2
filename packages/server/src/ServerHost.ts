import type { AppInfo } from "@get-halo/shared/rpc";
import type { CredentialVault } from "./agent/runtime/CredentialVault.js";
import type { FilesystemService } from "./filesystem/FilesystemService.js";

export type CredentialVaultInput = {
  filesystem: FilesystemService;
  workspaceRoot: string;
};

export interface ServerHost {
  getAppInfo(): AppInfo;
  installAppUpdate(): Error | undefined;
  chooseWorkspace(): Promise<Error | string | undefined>;
  openExternal(url: string): Promise<Error | undefined>;
  createCredentialVault(input: CredentialVaultInput): CredentialVault;
}
