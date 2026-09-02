import { homedir } from "node:os";
import * as errore from "errore";
import { createHaloRpcClient } from "./haloRpcClient.js";
import { findHaloRpcFile } from "./findHaloRpcFile.js";
import { HaloRpcFileError } from "./rpcFile.js";

export type HaloRpcEnv = {
  HALO_RPC_FILE?: string;
  HALO_USER_DATA?: string;
};

export class HaloVersionError extends errore.createTaggedError({
  name: "HaloVersionError",
  message:
    "This halo is $cliVersion; the running Halo app is $appVersion. Reopen the workspace.",
}) {}

export function cliVersion() {
  return process.env.HALO_VERSION;
}

export type HaloAppInfoClient = {
  getAppInfo: () => Promise<{ version: string }>;
};

export async function connectHalo<T extends HaloAppInfoClient>(
  env: HaloRpcEnv,
) {
  const file = await findHaloRpcFile({
    rpcFile: env.HALO_RPC_FILE,
    userDataDir: env.HALO_USER_DATA,
    cwd: process.cwd(),
    homeDir: homedir(),
    platform: process.platform,
    appData: process.env.APPDATA,
  });
  if (file instanceof Error) return file;
  const client = createHaloRpcClient<T>(file);
  const expected = cliVersion();
  if (expected === undefined) return { file, client };
  const info = await client
    .getAppInfo()
    .catch(
      (e) => new HaloRpcFileError({ detail: "getAppInfo failed", cause: e }),
    );
  if (info instanceof Error) return info;
  if (info.version !== expected) {
    return new HaloVersionError({
      cliVersion: expected,
      appVersion: info.version,
    });
  }
  return { file, client };
}
