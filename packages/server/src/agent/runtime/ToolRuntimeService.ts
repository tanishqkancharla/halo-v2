import * as errore from "errore";
import type { ConnectionRequest } from "@get-halo/shared/connectionRequests";
import type { UserService } from "../../UserService.js";
import type { FilesystemService } from "../../filesystem/FilesystemService.js";
import type { ServerHost } from "../../ServerHost.js";
import type { WorkspaceService } from "../../workspace/WorkspaceService.js";
import type { HaloToolPlugin } from "../tools/HaloToolPlugin.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import { ToolRuntime, ToolRuntimeError } from "./ToolRuntime.js";

export class ConnectionCancelledError extends errore.createTaggedError({
  name: "ConnectionCancelledError",
  message: "The connection was not completed.",
}) {}

type PendingConnection = {
  sessionId: string;
  request: ConnectionRequest;
};

type ToolRuntimeServiceOptions = {
  filesystem: FilesystemService;
  workspace: WorkspaceService;
  user: UserService;
  toolPlugins: readonly HaloToolPlugin[];
  authority: AgentAuthority;
  host: ServerHost;
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

    const credentialVault = this.options.host.createCredentialVault({
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
    this.pendingConnections.clear();
    if (runtime === undefined) return;
    return await runtime.close();
  }

  async startConnection(input: {
    sessionId: string;
    request: ConnectionRequest;
  }) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth start",
        cause: new Error("Executor runtime is not open"),
      });
    }

    const started = await this.runtime.startOAuth(input.request);
    if (started instanceof Error) return started;
    if (started.status === "connected") return { status: "connected" } as const;

    this.pendingConnections.set(started.state, input);
    return {
      status: "authorization-required",
      authorizationUrl: started.authorizationUrl,
      connectionId: started.state,
    } as const;
  }

  async completeOAuth(input: { state: string; code: string }) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth completion",
        cause: new Error("Executor runtime is not open"),
      });
    }
    const pending = this.pendingConnections.get(input.state);
    this.pendingConnections.delete(input.state);
    const completed = await this.runtime.completeOAuth(input);
    if (completed instanceof Error) return completed;
    return pending;
  }

  getPendingConnection(connectionId: string) {
    return this.pendingConnections.get(connectionId);
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
    }
    if (cancelled instanceof Error) return cancelled;
    return pending;
  }

  async cancelConnection(input: { sessionId: string; connectionId: string }) {
    const pending = this.pendingConnections.get(input.connectionId);
    if (pending === undefined || pending.sessionId !== input.sessionId) {
      return new ConnectionCancelledError();
    }
    return await this.cancelOAuth(input.connectionId);
  }
}
