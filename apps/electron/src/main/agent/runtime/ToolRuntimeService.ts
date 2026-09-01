import { shell } from "electron";
import * as errore from "errore";
import type { ConnectionRequest } from "@repo/shared/connectionRequests";
import type { UserService } from "../../UserService.js";
import type { FilesystemService } from "../../filesystem/FilesystemService.js";
import type { WorkspaceService } from "../../workspace/WorkspaceService.js";
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

type ToolRuntimeServiceOptions = {
  filesystem: FilesystemService;
  workspace: WorkspaceService;
  user: UserService;
  toolPlugins: readonly HaloToolPlugin[];
  authority: AgentAuthority;
};

export class ToolRuntimeService {
  private runtime: ToolRuntime | undefined;
  private workspaceRoot: string | undefined;
  private userId: string | undefined;
  private oauthRedirectUri: string | undefined;
  private readonly pendingConnections = new Map<string, PendingConnection>();

  constructor(private readonly options: ToolRuntimeServiceOptions) {}

  setOAuthRedirectUri(oauthRedirectUri: string) {
    this.oauthRedirectUri = oauthRedirectUri;
  }

  async get() {
    const layout = this.options.workspace.getLayout();
    if (layout instanceof Error) return layout;
    const user = await this.options.user.getUser();
    if (user instanceof Error) return user;

    if (
      this.runtime !== undefined &&
      this.workspaceRoot === layout.root &&
      this.userId === user.id
    ) {
      return this.runtime;
    }

    const closed = await this.close();
    if (closed instanceof Error) return closed;

    const credentialVault = createEncryptedFileCredentialVault({
      filesystem: this.options.filesystem,
      workspaceRoot: layout.root,
    });

    const runtime = await ToolRuntime.create({
      filesystem: this.options.filesystem,
      workspaceRoot: layout.root,
      userId: user.id,
      credentialVault,
      toolPlugins: this.options.toolPlugins,
      authority: this.options.authority,
      oauthRedirectUri: this.oauthRedirectUri,
    });
    if (runtime instanceof Error) return runtime;
    this.runtime = runtime;
    this.workspaceRoot = layout.root;
    this.userId = user.id;
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
    return await runtime.close();
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
    const opened = await shell.openExternal(started.authorizationUrl).catch(
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
