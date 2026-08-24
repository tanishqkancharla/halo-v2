import * as errore from "errore";
import { googleService } from "../shared/GoogleCatalog.js";
import type {
  IntegrationConnection,
  StoredTokens,
} from "./IntegrationService.js";

export class GoogleApiRequestError extends errore.createTaggedError({
  name: "GoogleApiRequestError",
  message: "$reason",
}) {}

export async function googleApiRequest(input: {
  connection: IntegrationConnection;
  tokens: StoredTokens;
  method: string;
  path: string;
  query: Record<string, string> | undefined;
  body: unknown;
  refresh: (tokens: StoredTokens) => Promise<Error | StoredTokens>;
}) {
  const url = googleApiUrl({
    service: input.connection.service,
    path: input.path,
    query: input.query,
  });
  if (url instanceof Error) return url;

  const expired =
    input.tokens.expiresAtMs !== undefined &&
    Date.now() >= input.tokens.expiresAtMs;
  const tokens = expired ? await input.refresh(input.tokens) : input.tokens;
  if (tokens instanceof Error) return tokens;

  const first = await fetchGoogleApi({
    url,
    method: input.method,
    accessToken: tokens.accessToken,
    body: input.body,
  });
  if (first instanceof Error) return first;
  if (first.status !== 401) return first;

  const refreshed = await input.refresh(tokens);
  if (refreshed instanceof Error) return refreshed;
  return fetchGoogleApi({
    url,
    method: input.method,
    accessToken: refreshed.accessToken,
    body: input.body,
  });
}

function googleApiUrl(input: {
  service: string;
  path: string;
  query: Record<string, string> | undefined;
}) {
  if (
    !input.path.startsWith("/") ||
    input.path.startsWith("//") ||
    input.path.includes("://") ||
    input.path.includes("..")
  ) {
    return new GoogleApiRequestError({
      reason: "Path is not a single URL path",
    });
  }
  const service = googleService(input.service);
  if (service === undefined) {
    return new GoogleApiRequestError({
      reason: `Unknown service "${input.service}"`,
    });
  }
  const url = new URL(input.path, service.apiHost);
  if (url.origin !== new URL(service.apiHost).origin) {
    return new GoogleApiRequestError({
      reason: "Path is not a single URL path",
    });
  }
  if (input.query !== undefined) {
    for (const [key, value] of Object.entries(input.query)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function fetchGoogleApi(input: {
  url: URL;
  method: string;
  accessToken: string;
  body: unknown;
}) {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${input.accessToken}`);
  const init: RequestInit = {
    method: input.method,
    headers,
  };
  if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(input.body);
  }
  const response = await fetch(input.url, init).catch(
    (e) =>
      new GoogleApiRequestError({
        reason: "Google API request failed",
        cause: e,
      }),
  );
  if (response instanceof Error) return response;
  const bodyText = await response.text().catch(
    (e) =>
      new GoogleApiRequestError({
        reason: "Google API response could not be read",
        cause: e,
      }),
  );
  if (bodyText instanceof Error) return bodyText;
  return { status: response.status, bodyText };
}
