import { shell } from "electron";
import * as errore from "errore";
import type { ConnectionRequest } from "../../../shared/connectionRequests.js";
import type { HaloToolPlugin } from "../tools/HaloToolPlugin.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import { createEncryptedFileCredentialVault } from "./EncryptedFileCredentialVault.js";
import { ToolRuntime, ToolRuntimeError } from "./ToolRuntime.js";

export class ConnectionCancelledError extends errore.createTaggedError({
  name: "ConnectionCancelledError",
  message: "The connection was not completed.",
}) {}

type PendingConnection = {
  complete: (result: Error | undefined) => void;
};

export class ToolRuntimeService {
  private runtime: ToolRuntime | undefined;
  private workspaceRoot: string | undefined;
  private userId: string | undefined;
  private oauthRedirectUri: string | undefined;
  private readonly pendingConnections = new Map<string, PendingConnection>();

  setOAuthRedirectUri(oauthRedirectUri: string) {
    this.oauthRedirectUri = oauthRedirectUri;
  }

  async get(input: {
    workspaceRoot: string;
    userId: string;
    toolPlugins: readonly HaloToolPlugin[];
    authority: AgentAuthority;
  }) {
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

    const runtime = await ToolRuntime.create({
      workspaceRoot: input.workspaceRoot,
      userId: input.userId,
      credentialVault,
      toolPlugins: input.toolPlugins,
      authority: input.authority,
      oauthRedirectUri: this.oauthRedirectUri,
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
    const closedError = new ToolRuntimeError({
      operation: "OAuth connection",
      cause: new Error("Executor runtime closed"),
    });
    for (const pending of this.pendingConnections.values()) {
      pending.complete(closedError);
    }
    this.pendingConnections.clear();
    if (runtime === undefined) return;
    return runtime.close();
  }

  async startConnection(request: ConnectionRequest) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth start",
        cause: new Error("Executor runtime is not open"),
      });
    }

    const started = await this.runtime.startOAuth(request);
    if (started instanceof Error) return started;
    if (started.status === "connected") return;

    const completed = new Promise<Error | undefined>((resolve) => {
      this.pendingConnections.set(started.state, { complete: resolve });
    });
    const opened = await shell
      .openExternal(started.authorizationUrl)
      .then(() => undefined)
      .catch(
        (cause) =>
          new ToolRuntimeError({
            operation: "opening OAuth authorization",
            cause,
          }),
      );
    if (opened instanceof Error) {
      this.pendingConnections.delete(started.state);
      const cancelled = await this.runtime.cancelOAuth(started.state);
      if (cancelled instanceof Error)
        console.warn("OAuth cleanup failed:", cancelled);
      return opened;
    }
    return completed;
  }

  async completeOAuth(input: { state: string; code: string }) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth completion",
        cause: new Error("Executor runtime is not open"),
      });
    }
    const completed = await this.runtime.completeOAuth(input);
    const pending = this.pendingConnections.get(input.state);
    if (pending !== undefined) {
      this.pendingConnections.delete(input.state);
      pending.complete(completed instanceof Error ? completed : undefined);
    }
    return completed;
  }

  async cancelOAuth(state: string) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth cancellation",
        cause: new Error("Executor runtime is not open"),
      });
    }
    const cancelled = await this.runtime.cancelOAuth(state);
    const pending = this.pendingConnections.get(state);
    if (pending !== undefined) {
      this.pendingConnections.delete(state);
      pending.complete(new ConnectionCancelledError());
    }
    if (cancelled instanceof Error) return cancelled;
  }
}
