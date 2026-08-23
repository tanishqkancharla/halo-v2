import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Flex,
  backgroundColor,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { googleScopeLabel, googleService } from "../../shared/GoogleCatalog.js";
import type { ConnectionIntent } from "../../shared/integrations.js";
import { useApi } from "../api/ApiProvider.tsx";
import type { SessionViewPart } from "../agentSession/sessionView.ts";

type IntegrationConnectPart = Extract<
  SessionViewPart,
  { kind: "integrationConnect" }
>;

export function IntegrationCard({
  sessionId,
  part,
}: {
  sessionId: string | undefined;
  part: IntegrationConnectPart;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const connectionId = part.connectionId;
  const query = useQuery({
    queryKey: ["integrations", "get", connectionId],
    queryFn: async () => {
      // SAFETY: enabled is false until connectionId is a string.
      const connection = await api.integrations.get({
        connectionId: connectionId as string,
      });
      // React Query keeps the last value when queryFn returns undefined.
      return { connection };
    },
    enabled: connectionId !== undefined,
  });
  const startOAuth = useMutation({
    mutationFn: () => {
      // SAFETY: the button is disabled until both ids are strings.
      return api.integrations.startOAuth({
        connectionId: connectionId as string,
        sessionId: sessionId as string,
      });
    },
    onSuccess: (connection) => {
      queryClient.setQueryData(["integrations", "get", connectionId], {
        connection,
      });
    },
    onError: (error) => {
      console.warn("Google OAuth failed:", error);
    },
  });
  const disconnect = useMutation({
    mutationFn: () => {
      // SAFETY: the button is disabled until both ids are strings.
      return api.integrations.disconnect({
        connectionId: connectionId as string,
        sessionId: sessionId as string,
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["integrations", "get", connectionId], {
        connection: undefined,
      });
    },
    onError: (error) => {
      console.warn("Google disconnect failed:", error);
    },
  });

  const disconnected = query.isSuccess && query.data.connection === undefined;
  const live = query.data?.connection;
  const serviceId = live === undefined ? part.service : live.service;
  const catalog = googleService(serviceId);
  const serviceLabel = catalog === undefined ? serviceId : catalog.label;
  const intent = live === undefined ? part.intent : live.intent;
  const status = live === undefined ? undefined : live.status;
  const scopes = live === undefined ? part.scopes : live.scopes;
  const card = useStyles(styles.card);
  const title = useStyles(styles.title);
  const scope = useStyles(styles.scope);
  const statusLabel = useStyles(styles.status);

  const view = cardView({
    disconnected,
    status,
    intent,
    scopes,
  });

  return (
    <section
      className={card}
      aria-label={`${serviceLabel} connection`}
      data-session-id={sessionId}
      data-connection-id={connectionId}
      data-intent={intent}
      data-testid="integration-card"
    >
      <Flex column gap={4}>
        <div className={title}>{serviceLabel}</div>
        {view.scopes.length === 0 ? undefined : (
          <Flex column gap={1}>
            {view.scopes.map((scopeId) => (
              <div key={scopeId} className={scope}>
                {googleScopeLabel(scopeId)}
              </div>
            ))}
          </Flex>
        )}
        {view.button === undefined ? (
          <div className={statusLabel}>{view.statusText}</div>
        ) : (
          <Button
            disabled={
              startOAuth.isPending ||
              disconnect.isPending ||
              connectionId === undefined ||
              sessionId === undefined
            }
            onClick={() => {
              if (connectionId === undefined) return;
              if (sessionId === undefined) return;
              if (view.button === "Disconnect") {
                disconnect.mutate();
                return;
              }
              startOAuth.mutate();
            }}
          >
            {view.button}
          </Button>
        )}
      </Flex>
    </section>
  );
}

function cardView(input: {
  disconnected: boolean;
  status: "pending" | "connected" | undefined;
  intent: ConnectionIntent | undefined;
  scopes: string[];
}) {
  if (input.disconnected) {
    return { scopes: [], button: undefined, statusText: "Disconnected" };
  }
  if (input.status === "connected") {
    return { scopes: [], button: undefined, statusText: "Connected" };
  }
  if (input.intent === "disconnect") {
    return { scopes: [], button: "Disconnect", statusText: undefined };
  }
  if (input.intent === "upgrade") {
    return { scopes: input.scopes, button: "Manage", statusText: undefined };
  }
  if (input.intent === "connect") {
    return { scopes: input.scopes, button: "Connect", statusText: undefined };
  }
  return { scopes: input.scopes, button: undefined, statusText: "Connected" };
}

const styles = {
  card: style(shadow.subtle, radius.lg, spacing.padding({ all: 12 }), {
    width: "100%",
    minWidth: 0,
    backgroundColor: backgroundColor.element,
  }),
  title: style(text("md", 500, "highContrast")),
  scope: style(text("sm", 400, "lowContrast")),
  status: style(text("sm", 500, "highContrast")),
};
