import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Flex,
  backgroundColor,
  colors,
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
import { GoogleServiceIcon } from "./GoogleServiceIcon.tsx";

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
  const description = catalog === undefined ? undefined : catalog.description;
  const intent = live === undefined ? part.intent : live.intent;
  const status = live === undefined ? undefined : live.status;
  const scopes = live === undefined ? part.scopes : live.scopes;
  const card = useStyles(styles.card);
  const iconTile = useStyles(styles.iconTile);
  const copy = useStyles(styles.copy);
  const title = useStyles(styles.title);
  const detail = useStyles(styles.detail);
  const meta = useStyles(styles.meta);
  const statusLabel = useStyles(styles.status);
  const action = useStyles(styles.action);

  const view = cardView({
    disconnected,
    status,
    intent,
    scopes,
  });
  const scopeLine = view.scopes
    .map((scopeId) => googleScopeLabel(scopeId))
    .join(" · ");

  return (
    <section
      className={card}
      aria-label={`${serviceLabel} connection`}
      data-session-id={sessionId}
      data-connection-id={connectionId}
      data-intent={intent}
      data-testid="integration-card"
    >
      <Flex row gap={4} alignItems="center">
        <div className={iconTile}>
          <GoogleServiceIcon serviceId={serviceId} />
        </div>
        <div className={copy}>
          <Flex column gap={1}>
            <div className={title}>{serviceLabel}</div>
            {description === undefined ? undefined : (
              <div className={detail}>{description}</div>
            )}
            {scopeLine.length === 0 ? undefined : (
              <div className={meta}>{scopeLine}</div>
            )}
          </Flex>
        </div>
        <div className={action}>
          {view.statusText === undefined ? undefined : (
            <div className={statusLabel}>{view.statusText}</div>
          )}
          {view.button === undefined ? undefined : (
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
        </div>
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
  if (input.intent === "disconnect") {
    return { scopes: [], button: "Disconnect", statusText: undefined };
  }
  if (input.status === "connected") {
    return { scopes: [], button: "Disconnect", statusText: "Connected" };
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
  iconTile: style(radius.md, {
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    backgroundColor: "light-dark(#ffffff, #ffffff)",
  }),
  copy: style({
    flex: 1,
    minWidth: 0,
  }),
  title: style(text("md", 600, "highContrast")),
  detail: style(text("sm", 400, "highContrast"), {
    color: colors.gray[11],
  }),
  meta: style(text("xs", 400, "lowContrast")),
  status: style(text("sm", 500, "highContrast")),
  action: style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: spacing.value(1),
    flexShrink: 0,
  }),
};
