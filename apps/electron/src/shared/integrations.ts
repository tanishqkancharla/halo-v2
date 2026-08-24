import type { GoogleServiceId } from "./GoogleCatalog.js";

export type ConnectionStatus = "pending" | "connected";

export type ConnectionIntent = "connect" | "upgrade" | "disconnect";

export const defaultIntegrationProfile = "default";

export type IntegrationConnection = {
  id: string;
  service: GoogleServiceId;
  profile: string;
  scopes: string[];
  status: ConnectionStatus;
  intent: ConnectionIntent | undefined;
};
