import { randomUUID } from "node:crypto";
import { OAUTH2_SESSION_TTL_MS } from "@executor-js/sdk/core";
import * as errore from "errore";
import type { ConnectionRequest } from "@get-halo/shared/connectionRequests";
import type {
  ConnectionStarted,
  HaloConnectionEvent,
} from "@get-halo/shared/contract";
import type { UserService } from "../../UserService.js";
import type { FilesystemService } from "../../filesystem/FilesystemService.js";
import type { WorkspaceService } from "../../workspace/WorkspaceService.js";
import type { HaloToolPlugin } from "../tools/HaloToolPlugin.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import { createEncryptedFileCredentialVault } from "./EncryptedFileCredentialVault.js";
import { ToolRuntime, ToolRuntimeError } from "./ToolRuntime.js";

export class ConnectionSessionMismatchError extends errore.createTaggedError({
  name: "ConnectionSessionMismatchError",
  message: "The connection does not belong to session '$sessionId'.",
}) {}

type PendingConnection = {
  connectionId: string;
  expires: ReturnType<typeof setTimeout>;
  onEvent: (event: HaloConnectionEvent) => Promise<Error | undefined>;
  request: ConnectionRequest;
  sessionId: string;
  state: string;
};

type StartConnectionInput = {
  onEvent: PendingConnection["onEvent"];
  request: ConnectionRequest;
  sessionId: string;
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
  private readonly connectionIdsByState = new Map<string, string>();

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
    for (const pending of this.pendingConnections.values()) {
      clearTimeout(pending.expires);
    }
    this.pendingConnections.clear();
    this.connectionIdsByState.clear();
    if (runtime === undefined) return;
    return await runtime.close();
  }

  async startConnection(
    input: StartConnectionInput,
  ): Promise<ConnectionStarted | Error> {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth start",
        cause: new Error("Executor runtime is not open"),
      });
    }

    const started = await this.runtime.startOAuth(input.request);
    if (started instanceof Error) return started;
    if (started.status === "connected") return { status: "connected" };

    const connectionId = randomUUID();
    const expires = setTimeout(async () => {
      const expired = await this.expireConnection(connectionId);
      if (expired instanceof Error) {
        console.warn("OAuth expiry failed:", expired);
      }
    }, OAUTH2_SESSION_TTL_MS);
    const pending: PendingConnection = {
      connectionId,
      expires,
      onEvent: input.onEvent,
      request: input.request,
      sessionId: input.sessionId,
      state: started.state,
    };
    this.pendingConnections.set(connectionId, pending);
    this.connectionIdsByState.set(started.state, connectionId);
    return {
      status: "authorization-required",
      authorizationUrl: started.authorizationUrl,
      connectionId,
      expiresInMs: OAUTH2_SESSION_TTL_MS,
    };
  }

  async completeOAuth(input: { state: string; code: string }) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth completion",
        cause: new Error("Executor runtime is not open"),
      });
    }
    const pending = this.takeConnectionByState(input.state);
    const completed = await this.runtime.completeOAuth(input);
    if (completed instanceof Error) {
      if (pending !== undefined) {
        const notified = await pending.onEvent(
          this.connectionEvent(pending, "cancelled"),
        );
        if (notified instanceof Error) {
          console.warn("OAuth failure notification failed:", notified);
        }
      }
      return completed;
    }
    if (pending === undefined) return;
    return await pending.onEvent(this.connectionEvent(pending, "connected"));
  }

  async cancelOAuth(state: string) {
    if (this.runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth cancellation",
        cause: new Error("Executor runtime is not open"),
      });
    }
    const pending = this.takeConnectionByState(state);
    const cancelled = await this.runtime.cancelOAuth(state);
    const notified =
      pending === undefined
        ? undefined
        : await pending.onEvent(this.connectionEvent(pending, "cancelled"));
    if (cancelled instanceof Error) return cancelled;
    return notified;
  }

  async cancelConnection(input: { connectionId: string; sessionId: string }) {
    const pending = this.pendingConnections.get(input.connectionId);
    if (pending === undefined) return;
    if (pending.sessionId !== input.sessionId) {
      return new ConnectionSessionMismatchError({ sessionId: input.sessionId });
    }
    const runtime = this.runtime;
    if (runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth cancellation",
        cause: new Error("Executor runtime is not open"),
      });
    }
    this.takeConnection(input.connectionId);
    const cancelled = await runtime.cancelOAuth(pending.state);
    const notified = await pending.onEvent(
      this.connectionEvent(pending, "cancelled"),
    );
    if (cancelled instanceof Error) return cancelled;
    return notified;
  }

  private async expireConnection(connectionId: string) {
    const pending = this.takeConnection(connectionId);
    if (pending === undefined) return;
    const runtime = this.runtime;
    if (runtime === undefined) {
      return new ToolRuntimeError({
        operation: "OAuth expiration",
        cause: new Error("Executor runtime is not open"),
      });
    }
    const cancelled = await runtime.cancelOAuth(pending.state);
    const notified = await pending.onEvent(
      this.connectionEvent(pending, "expired"),
    );
    if (cancelled instanceof Error) return cancelled;
    return notified;
  }

  private takeConnectionByState(state: string) {
    const connectionId = this.connectionIdsByState.get(state);
    if (connectionId === undefined) return undefined;
    return this.takeConnection(connectionId);
  }

  private takeConnection(connectionId: string) {
    const pending = this.pendingConnections.get(connectionId);
    if (pending === undefined) return;
    clearTimeout(pending.expires);
    this.pendingConnections.delete(connectionId);
    this.connectionIdsByState.delete(pending.state);
    return pending;
  }

  private connectionEvent(
    pending: PendingConnection,
    status: HaloConnectionEvent["status"],
  ): HaloConnectionEvent {
    return {
      type: "halo.connection",
      connectionId: pending.connectionId,
      request: pending.request,
      status,
    };
  }
}
