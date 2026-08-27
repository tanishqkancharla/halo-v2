import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Flex, Spacer, Text } from "maui";
import { style, useStyles } from "purse-styles";
import { connectionRequestLabel } from "../../shared/connectionRequests.js";
import { useApi } from "../api/ApiProvider.tsx";
import type { SessionViewPart } from "../agentSession/sessionView.ts";
import { integrationBrands } from "../IntegrationBrands.ts";

type ExecutorConnectionPart = Extract<
  SessionViewPart,
  { kind: "executorConnection" }
>;
type ConnectionStatus = "idle" | "connecting" | "connected";
const idleStatus: ConnectionStatus = "idle";
const card = style({ width: "100%", maxWidth: "400px" });
const brandLogo = style({
  width: "24px",
  height: "24px",
  objectFit: "contain",
  flexShrink: 0,
});
const brandButton = style({
  flexShrink: 0,
});

export function ExecutorConnectionCard({
  sessionId,
  part,
}: {
  sessionId: string | undefined;
  part: ExecutorConnectionPart;
}) {
  const api = useApi();
  const cardClassName = useStyles(card);
  const brandLogoClassName = useStyles(brandLogo);
  const brandButtonClassName = useStyles(brandButton);
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
  const brand = integrationBrands.google;

  return (
    <section
      aria-label={`${label} connection`}
      data-session-id={sessionId}
      data-integration={part.request.integration}
      data-testid="executor-connection-card"
      className={cardClassName}
    >
      <Flex column gap={6} p={6} shadow="subtle" radius="lg">
        <Flex row gap={4} alignItems="start">
          {/* Electron has no Next.js image component; this logo is a local build asset. */}
          {/* oxlint-disable-next-line next/no-img-element */}
          <img src={brand.logoUrl} alt="" className={brandLogoClassName} />
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
            variantColor={brand.buttonColor}
            style={{ color: brand.buttonForeground }}
            className={brandButtonClassName}
            disabled={sessionId === undefined || status !== "idle"}
            onClick={() => connect.mutate()}
          >
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
