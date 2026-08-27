import { shell } from "electron";
import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { contract } from "../../shared/contract.js";
import type { SessionRegistry } from "../agent/SessionRegistry.js";
import { orpcErrors } from "../orpcErrors.js";
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
} from "./notifyIntegrationConnected.js";

export type IntegrationsRouterContext = {
  integrations: IntegrationService;
  sessions: SessionRegistry;
  logger: Logger;
};

const os = implement(
  contract.integrations,
).$context<IntegrationsRouterContext>();

export const integrationsRouter = os.router({
  get: os.get.handler(async ({ input, context }) => {
    context.logger.info({
      event: "integrations.get",
      connectionId: input.connectionId,
    });
    const connection = await context.integrations.get(input.connectionId);
    if (connection instanceof Error) return orpcErrors.badRequest(connection);
    return connection;
  }),
  startOAuth: os.startOAuth.handler(async ({ input, context }) => {
    context.logger.info({
      event: "integrations.startOAuth",
      connectionId: input.connectionId,
      sessionId: input.sessionId,
    });
    const connection = await context.integrations.get(input.connectionId);
    if (connection instanceof Error) return orpcErrors.badRequest(connection);
    if (connection === undefined) {
      return orpcErrors.badRequest(
        new ConnectionNotFoundError({ id: input.connectionId }),
      );
    }
    if (connection.intent === "disconnect" || connection.scopes.length === 0) {
      return orpcErrors.badRequest(
        new GoogleOAuthError({ reason: "Disconnect is not OAuth." }),
      );
    }

    const previousTokens = await context.integrations.getTokens(connection.id);
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
  }),
  disconnect: os.disconnect.handler(async ({ input, context }) => {
    context.logger.info({
      event: "integrations.disconnect",
      connectionId: input.connectionId,
      sessionId: input.sessionId,
    });
    const connection = await context.integrations.get(input.connectionId);
    if (connection instanceof Error) return orpcErrors.badRequest(connection);
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
  }),
});

function notifySession(input: {
  context: IntegrationsRouterContext;
  sessionId: string;
  customType: "halo.integration.connected" | "halo.integration.disconnected";
  content: string;
  failed: string;
}) {
  void input.context.sessions.open(input.sessionId).then((session) => {
    if (session instanceof Error) {
      console.warn(input.failed, session.message);
      return;
    }
    void session
      .notify({
        customType: input.customType,
        content: input.content,
      })
      .then((notified) => {
        if (notified instanceof Error) {
          console.warn(input.failed, notified);
        }
      });
  });
}
