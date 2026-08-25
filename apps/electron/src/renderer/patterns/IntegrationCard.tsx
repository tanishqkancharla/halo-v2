import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Flex, Spacer, Text } from "maui";
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

  const view = cardView({ disconnected, status, intent, scopes });
  const scopeLine = view.scopes
    .map((scopeId) => googleScopeLabel(scopeId))
    .join(" · ");

  return (
    <section
      aria-label={`${serviceLabel} connection`}
      data-session-id={sessionId}
      data-connection-id={connectionId}
      data-intent={intent}
      data-testid="integration-card"
    >
      <Flex column gap={6} p={6} shadow="subtle" radius="lg">
        <Flex row gap={4} alignItems="start">
          <Avatar name={serviceLabel} size="lg" />
          <Flex column gap={1}>
            <Text size="md" fontWeight={600}>
              {serviceLabel}
            </Text>
            {description === undefined ? undefined : (
              <Text size="sm" color="lowContrast">
                {description}
              </Text>
            )}
            {scopeLine.length === 0 ? undefined : (
              <Text size="xs" color="lowContrast">
                {scopeLine}
              </Text>
            )}
            {view.statusText === undefined ? undefined : (
              <Text size="sm" fontWeight={500}>
                {view.statusText}
              </Text>
            )}
          </Flex>
          <Spacer />
          {view.button === undefined ? undefined : (
            <Button
              variant="primary"
              variantColor="blue"
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
              <GoogleServiceIcon serviceId={serviceId} />
              {view.button}
            </Button>
          )}
        </Flex>
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
