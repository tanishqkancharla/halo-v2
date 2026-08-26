import { createEncryptedFileCredentialVault } from "./EncryptedFileCredentialVault.js";
import { createExecutorToolRuntime } from "./ExecutorToolRuntime.js";
import type { ToolRuntime } from "./ToolRuntime.js";

export class ToolRuntimeService {
  private runtime: ToolRuntime | undefined;
  private workspaceRoot: string | undefined;
  private userId: string | undefined;

  async get(input: { workspaceRoot: string; userId: string }) {
    if (
      this.runtime !== undefined &&
      this.workspaceRoot === input.workspaceRoot &&
      this.userId === input.userId
    ) {
      return this.runtime;
    }

    const closed = await this.close();
    if (closed instanceof Error) return closed;

    const credentialVault = createEncryptedFileCredentialVault({
      workspaceRoot: input.workspaceRoot,
    });
    if (credentialVault instanceof Error) return credentialVault;

    const runtime = await createExecutorToolRuntime({
      workspaceRoot: input.workspaceRoot,
      userId: input.userId,
      credentialVault,
    });
    if (runtime instanceof Error) return runtime;
    this.runtime = runtime;
    this.workspaceRoot = input.workspaceRoot;
    this.userId = input.userId;
    return runtime;
  }

  async close() {
    const runtime = this.runtime;
    this.runtime = undefined;
    this.workspaceRoot = undefined;
    this.userId = undefined;
    if (runtime === undefined) return;
    return runtime.close();
  }
}
