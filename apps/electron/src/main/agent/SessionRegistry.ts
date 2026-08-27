import * as errore from "errore";
import type { ConnectionRequest } from "../../shared/connectionRequests.js";
import type { IntegrationService } from "../integrations/IntegrationService.js";
import type { UserService } from "../UserService.js";
import type { WorkspaceService } from "../workspace/WorkspaceService.js";
import type { AgentAuthority } from "./AgentAuthority.js";
import {
  HaloAgentSession,
  type HaloAgentSessionOptions,
} from "./HaloAgentSession.js";
import { ToolRuntimeService } from "./executor/ToolRuntimeService.js";
import type { HaloToolPluginFactory } from "./tools/HaloToolPlugin.js";

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

type SessionRegistryOptions = {
  workspace: WorkspaceService;
  user: UserService;
  integrations: IntegrationService;
  toolPluginFactories: readonly HaloToolPluginFactory[];
  authority: AgentAuthority;
};

export class SessionRegistry {
  private readonly sessions = new Map<string, HaloAgentSession>();
  private readonly opening = new Map<
    string,
    Promise<Error | HaloAgentSession>
  >();
  private readonly toolRuntime = new ToolRuntimeService();

  constructor(private readonly options: SessionRegistryOptions) {}

  setOAuthRedirectUri(oauthRedirectUri: string) {
    this.toolRuntime.setOAuthRedirectUri(oauthRedirectUri);
  }

  completeOAuth(input: { state: string; code: string }) {
    return this.toolRuntime.completeOAuth(input);
  }

  startConnection(request: ConnectionRequest) {
    return this.toolRuntime.startConnection(request);
  }

  list() {
    return HaloAgentSession.list(this.sessionOptions());
  }

  async create() {
    const session = await HaloAgentSession.create(this.sessionOptions());
    if (session instanceof Error) return session;
    this.register(session);
    return session;
  }

  async open(sessionId: string) {
    const live = this.sessions.get(sessionId);
    if (live !== undefined) return live;
    const pending = this.opening.get(sessionId);
    if (pending !== undefined) return pending;

    const opening = this.openAndRegister(sessionId);
    this.opening.set(sessionId, opening);
    const session = await opening;
    this.opening.delete(sessionId);
    return session;
  }

  async close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return new SessionNotOpenError({ sessionId });
    this.sessions.delete(sessionId);
    return session.close();
  }

  async shutdown() {
    const opening = [...this.opening.values()];
    await Promise.all(opening);
    this.opening.clear();

    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    const closed = await Promise.all(
      sessions.map((session) => session.close()),
    );
    const sessionError = closed.find((result) => result instanceof Error);
    const runtimeClosed = await this.toolRuntime.close();
    if (sessionError instanceof Error) return sessionError;
    if (runtimeClosed instanceof Error) return runtimeClosed;
  }

  private async openAndRegister(sessionId: string) {
    const session = await HaloAgentSession.open({
      ...this.sessionOptions(),
      sessionId,
    });
    if (session instanceof Error) return session;
    this.register(session);
    return session;
  }

  private register(session: HaloAgentSession) {
    this.sessions.set(session.sessionId, session);
  }

  private sessionOptions(): HaloAgentSessionOptions {
    return {
      ...this.options,
      toolRuntime: this.toolRuntime,
    };
  }
}
