import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Flex, Spacer, Text } from "maui";
import { connectionRequestLabel } from "../../shared/connectionRequests.js";
import { useApi } from "../api/ApiProvider.tsx";
import type { SessionViewPart } from "../agentSession/sessionView.ts";
import { GoogleServiceIcon } from "./GoogleServiceIcon.tsx";

type ExecutorConnectionPart = Extract<
  SessionViewPart,
  { kind: "executorConnection" }
>;
type ConnectionStatus = "idle" | "connecting" | "connected";
const idleStatus: ConnectionStatus = "idle";

export function ExecutorConnectionCard({
  sessionId,
  part,
}: {
  sessionId: string | undefined;
  part: ExecutorConnectionPart;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const statusKey = [
    "executorConnection",
    part.request.integration,
    part.request.connectionName,
  ] as const;
  const status = useQuery({
    queryKey: statusKey,
    queryFn: async () => idleStatus,
    initialData: idleStatus,
    enabled: false,
  }).data;
  const connect = useMutation({
    mutationFn: () => {
      // SAFETY: the button is disabled until sessionId is a string.
      return api.sessions.startConnection({
        sessionId: sessionId as string,
        request: part.request,
      });
    },
    onMutate: () => {
      queryClient.setQueryData(statusKey, "connecting");
    },
    onSuccess: () => {
      queryClient.setQueryData(statusKey, "connected");
    },
    onError: (error) => {
      queryClient.setQueryData(statusKey, "idle");
      console.warn("Connection failed:", error);
    },
  });
  const label = connectionRequestLabel(part.request);
  const serviceId = part.request.integration.replace(/^google_/, "");

  return (
    <section
      aria-label={`${label} connection`}
      data-session-id={sessionId}
      data-integration={part.request.integration}
      data-testid="executor-connection-card"
    >
      <Flex column gap={6} p={6} shadow="subtle" radius="lg">
        <Flex row gap={4} alignItems="start">
          <Avatar name={label} size="lg" />
          <Flex column gap={1}>
            <Text size="md" fontWeight={600}>
              {label}
            </Text>
            <Text size="sm" color="lowContrast">
              {status === "connected"
                ? "Connected"
                : status === "connecting"
                  ? "Finish connecting in your browser"
                  : "Connect your account so the agent can continue"}
            </Text>
          </Flex>
          <Spacer />
          <Button
            variant="primary"
            variantColor="blue"
            disabled={sessionId === undefined || status !== "idle"}
            onClick={() => connect.mutate()}
          >
            <GoogleServiceIcon serviceId={serviceId} />
            {status === "connected"
              ? "Connected"
              : status === "connecting"
                ? "Connecting"
                : "Connect"}
          </Button>
        </Flex>
      </Flex>
    </section>
  );
}
