import { dialog, shell, type BrowserWindow } from "electron";
import { implement } from "@orpc/server";
import { AsyncEventQueue } from "@halo/plugin-sdk/shared";
import type { Logger } from "@repo/logger";
import { agentSessionStateFromSession } from "../shared/AgentSessionState.js";
import { contract } from "../shared/contract.js";
import type { AgentSessionEvent, WorkspaceTreeEvent } from "../shared/rpc.js";
import {
  AbortFailedError,
  EmptyPromptError,
  PromptFailedError,
} from "./agent-session-errors.js";
import type { AgentSessionRegistry } from "./AgentSessionRegistry.js";
import { getAppInfo, installAppUpdate } from "./AppUpdate.js";
import { orpcErrors } from "./orpcErrors.js";
import {
  GoogleOAuthError,
  revokeGoogleToken,
  runGoogleLoopbackOAuth,
} from "./GoogleOAuth.js";
import {
  ConnectionNotFoundError,
  type IntegrationService,
} from "./IntegrationService.js";
import {
  integrationConnectedEventText,
  integrationDisconnectedEventText,
  notifyIntegrationEvent,
} from "./notifyIntegrationConnected.js";
import type { PiService } from "./pi-service.js";
import type { PluginService } from "./plugins/PluginService.js";
import type { WorkspaceService } from "./workspace-service.js";

export type HaloContext = {
  workspace: WorkspaceService;
  integrations: IntegrationService;
  pi: PiService;
  plugins: PluginService;
  sessions: AgentSessionRegistry;
  getWindow: () => BrowserWindow;
  logger: Logger;
};

const os = implement(contract).$context<HaloContext>();

const router = {
  getAppInfo: os.getAppInfo.handler(({ context }) => {
    context.logger.info({ event: "getAppInfo" });
    return getAppInfo();
  }),
  installAppUpdate: os.installAppUpdate.handler(() => {
    const result = installAppUpdate();
    if (result instanceof Error) return orpcErrors.badRequest(result);
  }),
  workspace: {
    get: os.workspace.get.handler(({ context }) => {
      context.logger.info({ event: "getWorkspace" });
      return context.workspace.getWorkspace();
    }),
    choose: os.workspace.choose.handler(async ({ context }) => {
      context.logger.info({ event: "chooseWorkspace" });
      const selection = await dialog.showOpenDialog(context.getWindow(), {
        title: "Choose a Halo workspace",
        buttonLabel: "Choose workspace",
        properties: ["openDirectory"],
      });
      if (selection.canceled) return undefined;
      const workspace = await context.workspace.select(selection.filePaths[0]!);
      if (workspace instanceof Error) return orpcErrors.badRequest(workspace);
      return workspace;
    }),
    listPaths: os.workspace.listPaths.handler(async ({ context }) => {
      context.logger.info({ event: "listWorkspacePaths" });
      const paths = await context.workspace.listPaths();
      if (paths instanceof Error) return orpcErrors.badRequest(paths);
      return paths;
    }),
    events: os.workspace.events.handler(({ context, signal }) => {
      context.logger.info({ event: "subscribeWorkspaceTree" });
      const queue = new AsyncEventQueue<WorkspaceTreeEvent[]>();
      context.workspace.setTreeListener((events) => {
        void queue.push(events);
      });
      return (async function* () {
        try {
          yield* queue.values(signal);
        } finally {
          context.workspace.setTreeListener(undefined);
        }
      })();
    }),
  },
  sessions: {
    list: os.sessions.list.handler(async ({ context }) => {
      context.logger.info({ event: "listSessions" });
      const sessions = await context.pi.listSessions();
      if (sessions instanceof Error) return orpcErrors.badRequest(sessions);
      return sessions;
    }),
    create: os.sessions.create.handler(async ({ context }) => {
      context.logger.info({ event: "newAgentSession" });
      const session = await context.pi.newAgentSession();
      if (session instanceof Error) return orpcErrors.badRequest(session);
      context.sessions.add(session);
      return { sessionId: session.sessionId };
    }),
    open: os.sessions.open.handler(async ({ input, context }) => {
      context.logger.info({
        event: "openAgentSession",
        sessionId: input.sessionId,
      });
      const live = context.sessions.get(input.sessionId);
      if (live instanceof Error) {
        const session = await context.pi.openAgentSession(input.sessionId);
        if (session instanceof Error) return orpcErrors.badRequest(session);
        context.sessions.add(session);
        return {
          sessionId: session.sessionId,
          state: agentSessionStateFromSession({
            messages: session.messages,
            isStreaming: session.isStreaming,
          }),
        };
      }
      return {
        sessionId: live.sessionId,
        state: agentSessionStateFromSession({
          messages: live.messages,
          isStreaming: live.isStreaming,
        }),
      };
    }),
    events: os.sessions.events.handler(({ input, context, signal }) => {
      context.logger.info({
        event: "agentSession.events",
        sessionId: input.sessionId,
      });
      const session = context.sessions.get(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      const queue = new AsyncEventQueue<AgentSessionEvent>();
      const unsubscribe = session.subscribe((event) => {
        void queue.push(event);
      });
      return (async function* () {
        try {
          yield* queue.values(signal);
        } finally {
          unsubscribe();
        }
      })();
    }),
    prompt: os.sessions.prompt.handler(async ({ input, context }) => {
      context.logger.info({
        event: "prompt",
        sessionId: input.sessionId,
        textLength: input.text.length,
      });
      const session = context.sessions.get(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      if (input.text.trim().length === 0)
        return orpcErrors.badRequest(new EmptyPromptError());
      const prompted = await session
        .prompt(input.text, { streamingBehavior: "steer" })
        .catch(
          (e) =>
            new PromptFailedError({
              reason: e instanceof Error ? e.message : String(e),
              cause: e,
            }),
        );
      if (prompted instanceof Error) return orpcErrors.badRequest(prompted);
    }),
    abort: os.sessions.abort.handler(async ({ input, context }) => {
      context.logger.info({
        event: "abort",
        sessionId: input.sessionId,
      });
      const session = context.sessions.get(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      const aborted = await session.abort().catch(
        (e) =>
          new AbortFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
      if (aborted instanceof Error) return orpcErrors.badRequest(aborted);
    }),
    close: os.sessions.close.handler(({ input, context }) => {
      context.logger.info({
        event: "agentSession.close",
        sessionId: input.sessionId,
      });
      const closed = context.sessions.close(input.sessionId);
      if (closed instanceof Error) return orpcErrors.badRequest(closed);
    }),
  },
  integrations: {
    get: os.integrations.get.handler(async ({ input, context }) => {
      context.logger.info({
        event: "integrations.get",
        connectionId: input.connectionId,
      });
      const connection = await context.integrations.get(input.connectionId);
      if (connection instanceof Error) return orpcErrors.badRequest(connection);
      return connection;
    }),
    startOAuth: os.integrations.startOAuth.handler(
      async ({ input, context }) => {
        context.logger.info({
          event: "integrations.startOAuth",
          connectionId: input.connectionId,
          sessionId: input.sessionId,
        });
        const connection = await context.integrations.get(input.connectionId);
        if (connection instanceof Error)
          return orpcErrors.badRequest(connection);
        if (connection === undefined) {
          return orpcErrors.badRequest(
            new ConnectionNotFoundError({ id: input.connectionId }),
          );
        }
        if (
          connection.intent === "disconnect" ||
          connection.scopes.length === 0
        ) {
          return orpcErrors.badRequest(
            new GoogleOAuthError({ reason: "Disconnect is not OAuth." }),
          );
        }

        const previousTokens = await context.integrations.getTokens(
          connection.id,
        );
        if (previousTokens instanceof Error)
          return orpcErrors.badRequest(previousTokens);

        const tokens = await runGoogleLoopbackOAuth({
          scopes: connection.scopes,
          // Electron shell.openExternal uses the OS default browser.
          openUrl: (url) =>
            shell
              .openExternal(url)
              .then(() => undefined)
              .catch(
                (e) =>
                  new GoogleOAuthError({
                    reason: "Failed to open the default browser",
                    cause: e,
                  }),
              ),
        });
        if (tokens instanceof Error) return orpcErrors.badRequest(tokens);

        const refreshToken = (() => {
          if (tokens.refreshToken !== undefined) return tokens.refreshToken;
          if (previousTokens === undefined) return undefined;
          // Google omits refresh_token on later grants.
          return previousTokens.refreshToken;
        })();

        const connected = await context.integrations.markConnected({
          id: connection.id,
          scopes: tokens.grantedScopes,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken,
            expiresAtMs: tokens.expiresAtMs,
            tokenType: tokens.tokenType,
          },
        });
        if (connected instanceof Error) return orpcErrors.badRequest(connected);

        notifySession({
          context,
          sessionId: input.sessionId,
          customType: "halo.integration.connected",
          content: integrationConnectedEventText(connected),
          failed: "Connected but could not notify the agent:",
        });

        return connected;
      },
    ),
    disconnect: os.integrations.disconnect.handler(
      async ({ input, context }) => {
        context.logger.info({
          event: "integrations.disconnect",
          connectionId: input.connectionId,
          sessionId: input.sessionId,
        });
        const connection = await context.integrations.get(input.connectionId);
        if (connection instanceof Error)
          return orpcErrors.badRequest(connection);
        if (connection === undefined) {
          return orpcErrors.badRequest(
            new ConnectionNotFoundError({ id: input.connectionId }),
          );
        }

        const tokens = await context.integrations.getTokens(connection.id);
        if (tokens instanceof Error) return orpcErrors.badRequest(tokens);
        if (tokens !== undefined) {
          const token =
            tokens.refreshToken === undefined
              ? tokens.accessToken
              : tokens.refreshToken;
          const revoked = await revokeGoogleToken(token);
          if (revoked instanceof Error) return orpcErrors.badRequest(revoked);
        }

        const removed = await context.integrations.remove(connection.id);
        if (removed instanceof Error) return orpcErrors.badRequest(removed);

        notifySession({
          context,
          sessionId: input.sessionId,
          customType: "halo.integration.disconnected",
          content: integrationDisconnectedEventText(connection.service),
          failed: "Disconnected but could not notify the agent:",
        });
      },
    ),
  },
  plugins: {
    list: os.plugins.list.handler(async ({ context }) => {
      context.logger.info({ event: "listPlugins" });
      const listed = await context.plugins.list();
      if (listed instanceof Error) return orpcErrors.badRequest(listed);
      context.logger.info({
        event: "listPluginsResult",
        pluginIds: listed.plugins.map((plugin) => plugin.id),
        compiledViewIds: listed.compiledViews.map((view) => view.id),
        errors: listed.errors,
      });
      return listed;
    }),
    create: os.plugins.create.handler(async ({ input, context }) => {
      context.logger.info({ event: "plugin.create", id: input.id });
      const created = await context.plugins.create(input.id);
      if (created instanceof Error) return orpcErrors.badRequest(created);
      return created;
    }),
    build: os.plugins.build.handler(async ({ context }) => {
      context.logger.info({ event: "plugin.build" });
      const built = await context.plugins.build();
      if (built instanceof Error) return orpcErrors.badRequest(built);
      return built;
    }),
    types: os.plugins.types.handler(async ({ context }) => {
      context.logger.info({ event: "plugin.types" });
      const checked = await context.plugins.types();
      if (checked instanceof Error) return orpcErrors.badRequest(checked);
      return checked;
    }),
  },
};

export function haloRpcRouter(plugins: PluginService) {
  return {
    ...router,
    plugins: { ...router.plugins, servers: plugins.lazyRouter },
  };
}

async function resolveLiveSession(context: HaloContext, sessionId: string) {
  const live = context.sessions.get(sessionId);
  if (!(live instanceof Error)) return live;
  const opened = await context.pi.openAgentSession(sessionId);
  if (opened instanceof Error) return opened;
  context.sessions.add(opened);
  return opened;
}

function notifySession(input: {
  context: HaloContext;
  sessionId: string;
  customType: "halo.integration.connected" | "halo.integration.disconnected";
  content: string;
  failed: string;
}) {
  void resolveLiveSession(input.context, input.sessionId).then((session) => {
    if (session instanceof Error) {
      console.warn(input.failed, session.message);
      return;
    }
    void notifyIntegrationEvent({
      session,
      customType: input.customType,
      content: input.content,
    }).then((notified) => {
      if (notified instanceof Error) {
        console.warn(input.failed, notified);
      }
    });
  });
}
