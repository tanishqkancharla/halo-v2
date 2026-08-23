import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  googleCatalog,
  googleService,
  type GoogleService,
} from "../shared/GoogleCatalog.js";
import { googleApiRequest } from "./GoogleApiRequest.js";
import { refreshGoogleAccessToken } from "./GoogleOAuth.js";
import {
  defaultIntegrationProfile,
  type ConnectionIntent,
  type ConnectionStatus,
  type IntegrationConnection,
  type IntegrationService,
} from "./IntegrationService.js";

type IntegrationToolPayload =
  | { error: string }
  | { services: GoogleService[] }
  | {
      status: "connected";
      connectionId: string;
      service: string;
      profile: string;
      scopes: string[];
    }
  | {
      status: ConnectionStatus;
      intent: ConnectionIntent | undefined;
      connectionId: string;
      service: string;
      profile: string;
      scopes: string[];
    }
  | { status: number; bodyText: string };

const catalogParameters = Type.Object({
  service: Type.Optional(
    Type.String({
      description: "Catalog id, e.g. gmail. Omit to list every service.",
    }),
  ),
});

const connectParameters = Type.Object({
  service: Type.String({
    description: "Catalog id, e.g. gmail",
  }),
  scopes: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Google OAuth scope URLs. Use integrations_catalog to pick. Omit or pass [] to ask the user to disconnect.",
    }),
  ),
});

const runParameters = Type.Object({
  service: Type.String(),
  method: Type.String(),
  path: Type.String({
    description:
      "Path on the service apiHost, e.g. /gmail/v1/users/me/messages",
  }),
  query: Type.Optional(Type.Record(Type.String(), Type.String())),
  body: Type.Optional(Type.Unknown()),
});

export function createIntegrationTools(
  integrations: IntegrationService,
): ToolDefinition[] {
  const catalog: ToolDefinition = {
    name: "integrations_catalog",
    label: "Integrations catalog",
    description:
      "List Halo's Google services and their known OAuth scopes. Pass service to see one entry.",
    promptSnippet:
      "integrations_catalog: list Google services and scopes before connect",
    promptGuidelines: [
      "Call integrations_catalog before integrations_connect when you need scope URLs.",
    ],
    parameters: catalogParameters,
    execute: async (_toolCallId, params) => {
      if (!Value.Check(catalogParameters, params)) {
        return textResult({ error: "Invalid integrations_catalog arguments" });
      }
      if (params.service === undefined) {
        return textResult({ services: googleCatalog() });
      }
      const service = googleService(params.service);
      if (service === undefined) {
        return textResult({
          error: `Unknown service "${params.service}". Call integrations_catalog.`,
        });
      }
      return textResult({ services: [service] });
    },
  };

  const connect: ToolDefinition = {
    name: "integrations_connect",
    label: "Integrations connect",
    description:
      "Ask the user to connect a Google service, add scopes, or disconnect. Returns immediately. Empty scopes asks the user to disconnect. Already granted scopes return connected.",
    promptSnippet:
      "integrations_connect: pending means the user must click the card",
    promptGuidelines: [
      "When integrations_connect returns pending, ask the user to click the card. Do not call integrations_run until they are connected.",
    ],
    parameters: connectParameters,
    execute: async (_toolCallId, params) => {
      if (!Value.Check(connectParameters, params)) {
        return textResult({ error: "Invalid integrations_connect arguments" });
      }
      const service = googleService(params.service);
      if (service === undefined) {
        return textResult({
          error: `Unknown service "${params.service}". Call integrations_catalog.`,
        });
      }
      const scopes = params.scopes === undefined ? [] : params.scopes;
      const existing = await integrations.findByService({
        service: service.id,
        profile: defaultIntegrationProfile,
      });
      if (existing instanceof Error)
        return textResult({ error: existing.message });

      if (scopes.length === 0) {
        if (existing === undefined || existing.status !== "connected") {
          return textResult({
            error: `Nothing to disconnect. ${service.id} is not connected.`,
          });
        }
        const pending = await integrations.createPending({
          service: service.id,
          profile: defaultIntegrationProfile,
          scopes: [],
          intent: "disconnect",
        });
        if (pending instanceof Error)
          return textResult({ error: pending.message });
        return textResult(connectPayload(pending));
      }

      if (
        existing !== undefined &&
        existing.status === "connected" &&
        hasAllScopes(existing.scopes, scopes)
      ) {
        return textResult({
          status: "connected",
          connectionId: existing.id,
          service: existing.service,
          profile: existing.profile,
          scopes: existing.scopes,
        });
      }

      const intent =
        existing !== undefined && existing.status === "connected"
          ? "upgrade"
          : "connect";
      const pending = await integrations.createPending({
        service: service.id,
        profile: defaultIntegrationProfile,
        scopes,
        intent,
      });
      if (pending instanceof Error)
        return textResult({ error: pending.message });
      return textResult(connectPayload(pending));
    },
  };

  const run: ToolDefinition = {
    name: "integrations_run",
    label: "Integrations run",
    description:
      "Call a Google API on a connected service. Fails if the service is not connected.",
    promptSnippet:
      "integrations_run: authenticated HTTP to a connected Google service",
    promptGuidelines: [
      "Call integrations_connect before integrations_run when the service is not connected.",
    ],
    parameters: runParameters,
    execute: async (_toolCallId, params) => {
      if (!Value.Check(runParameters, params)) {
        return textResult({ error: "Invalid integrations_run arguments" });
      }
      const service = googleService(params.service);
      if (service === undefined) {
        return textResult({
          error: `Unknown service "${params.service}". Call integrations_catalog.`,
        });
      }
      const connection = await integrations.findByService({
        service: service.id,
        profile: defaultIntegrationProfile,
      });
      if (connection instanceof Error) {
        return textResult({ error: connection.message });
      }
      if (connection === undefined || connection.status !== "connected") {
        return textResult({
          error: `${service.id} is not connected. Call integrations_connect.`,
        });
      }
      const tokens = await integrations.getTokens(connection.id);
      if (tokens instanceof Error) return textResult({ error: tokens.message });
      if (tokens === undefined) {
        return textResult({
          error: `${service.id} is not connected. Call integrations_connect.`,
        });
      }
      const response = await googleApiRequest({
        connection,
        tokens,
        method: params.method,
        path: params.path,
        query: params.query,
        body: params.body,
        refresh: async (current) => {
          const refreshed = await refreshGoogleAccessToken(current);
          if (refreshed instanceof Error) return refreshed;
          const stored = await integrations.markConnected({
            id: connection.id,
            scopes: connection.scopes,
            tokens: refreshed,
          });
          if (stored instanceof Error) return stored;
          return refreshed;
        },
      });
      if (response instanceof Error)
        return textResult({ error: response.message });
      return textResult(response);
    },
  };

  return [catalog, connect, run];
}

function connectPayload(connection: IntegrationConnection) {
  return {
    status: connection.status,
    intent: connection.intent,
    connectionId: connection.id,
    service: connection.service,
    profile: connection.profile,
    scopes: connection.scopes,
  };
}

function hasAllScopes(have: string[], requested: string[]) {
  for (const scope of requested) {
    if (!have.includes(scope)) return false;
  }
  return true;
}

function textResult(value: IntegrationToolPayload) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    details: {},
  };
}
