import { googleService } from "../../shared/GoogleCatalog.js";
import type { IntegrationConnection } from "../../shared/integrations.js";

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
