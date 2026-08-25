import type { AgentSession } from "@mariozechner/pi-coding-agent";
import * as errore from "errore";
import { googleService } from "../../shared/GoogleCatalog.js";
import type { IntegrationConnection } from "../../shared/integrations.js";

export class NotifyIntegrationEventError extends errore.createTaggedError({
  name: "NotifyIntegrationEventError",
  message: "Failed to notify the agent after an integration change",
}) {}

export function integrationConnectedEventText(
  connection: IntegrationConnection,
): string {
  const service = googleService(connection.service);
  const label = service === undefined ? connection.service : service.label;
  const scopes = connection.scopes.map((scope) => `- ${scope}`).join("\n");
  return `[System] The user connected ${label}.\n\nGranted scopes:\n${scopes}\n\nYou can now call integrations_run with service "${connection.service}". Continue the user's last request.`;
}

export function integrationDisconnectedEventText(serviceId: string): string {
  const service = googleService(serviceId);
  const label = service === undefined ? serviceId : service.label;
  return `[System] The user disconnected ${label}.\n\nintegrations_run for service "${serviceId}" will fail until the user connects again.`;
}

export async function notifyIntegrationEvent(input: {
  session: AgentSession;
  customType: "halo.integration.connected" | "halo.integration.disconnected";
  content: string;
}) {
  const sent = await input.session
    .sendCustomMessage(
      {
        customType: input.customType,
        content: input.content,
        display: false,
      },
      { triggerTurn: true, deliverAs: "steer" },
    )
    .catch((e) => new NotifyIntegrationEventError({ cause: e }));
  if (sent instanceof Error) return sent;
}
