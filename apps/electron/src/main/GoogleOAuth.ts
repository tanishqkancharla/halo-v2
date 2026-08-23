import { createHash, randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import * as errore from "errore";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { StoredTokens } from "./IntegrationService.js";

export const HALO_GOOGLE_OAUTH_CLIENT_ID =
  "912701444316-r6tced61mtv8jmjt31kf1did42f71f7b.apps.googleusercontent.com";

const googleAuthorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const closeTabHtml =
  '<!doctype html><html><head><meta charset="utf-8"><title>Halo</title></head><body>You can close this tab</body></html>';

export class GoogleOAuthError extends errore.createTaggedError({
  name: "GoogleOAuthError",
  message: "$reason",
}) {}

const listenAddressSchema = Type.Object({
  port: Type.Number(),
  family: Type.String(),
  address: Type.String(),
});

const tokenResponseSchema = Type.Object({
  access_token: Type.String({ minLength: 1 }),
  refresh_token: Type.Optional(Type.String({ minLength: 1 })),
  expires_in: Type.Optional(Type.Number()),
  token_type: Type.String({ minLength: 1 }),
  scope: Type.String({ minLength: 1 }),
});

export async function runGoogleLoopbackOAuth(input: {
  scopes: string[];
  openUrl: (url: string) => Promise<void | Error>;
}): Promise<Error | (StoredTokens & { grantedScopes: string[] })> {
  await using cleanup = new errore.AsyncDisposableStack();

  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const callback = createCallbackWaiter(state);
  const server = createServer((request, response) => {
    callback.handle(request, response);
  });
  cleanup.defer(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  );

  const port = await listenLoopback(server);
  if (port instanceof Error) return port;

  const redirectUri = `http://127.0.0.1:${port}/`;
  const authorizeUrl = buildAuthorizeUrl({
    redirectUri,
    scopes: input.scopes,
    state,
    challenge,
  });

  const opened = await input.openUrl(authorizeUrl);
  if (opened instanceof Error) return opened;

  const authorized = await callback.result;
  if (authorized instanceof Error) return authorized;

  return exchangeCode({
    code: authorized.code,
    redirectUri,
    verifier,
  });
}

function buildAuthorizeUrl(input: {
  redirectUri: string;
  scopes: string[];
  state: string;
  challenge: string;
}) {
  const url = new URL(googleAuthorizeUrl);
  url.searchParams.set("client_id", HALO_GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  // Google returns already-granted scopes together with the new ones.
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

function listenLoopback(server: ReturnType<typeof createServer>) {
  return new Promise<Error | number>((resolve) => {
    const onError = (e: Error) => {
      resolve(
        new GoogleOAuthError({ reason: "Loopback listen failed", cause: e }),
      );
    };
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      if (!Value.Check(listenAddressSchema, address)) {
        resolve(new GoogleOAuthError({ reason: "Loopback listen failed" }));
        return;
      }
      resolve(address.port);
    });
  });
}

function createCallbackWaiter(expectedState: string) {
  let settle: (value: Error | { code: string }) => void;
  const result = new Promise<Error | { code: string }>((resolve) => {
    settle = resolve;
  });
  let settled = false;

  function finish(value: Error | { code: string }, response: ServerResponse) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(closeTabHtml, () => {
      if (settled) return;
      settled = true;
      settle(value);
    });
  }

  function handle(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end();
      return;
    }
    if (request.url === undefined) {
      response.writeHead(400);
      response.end();
      return;
    }
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/") {
      response.writeHead(204);
      response.end();
      return;
    }
    const error = url.searchParams.get("error");
    if (error !== null) {
      finish(
        new GoogleOAuthError({ reason: `Google OAuth failed (${error})` }),
        response,
      );
      return;
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (code === null || state === null) {
      response.writeHead(400);
      response.end();
      return;
    }
    if (state !== expectedState) {
      finish(
        new GoogleOAuthError({ reason: "OAuth state mismatch" }),
        response,
      );
      return;
    }
    finish({ code }, response);
  }

  return { handle, result };
}

async function exchangeCode(input: {
  code: string;
  redirectUri: string;
  verifier: string;
}) {
  const body = new URLSearchParams({
    code: input.code,
    client_id: HALO_GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.verifier,
  });
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).catch(
    (e) => new GoogleOAuthError({ reason: "Token exchange failed", cause: e }),
  );
  if (response instanceof Error) return response;
  if (!response.ok) {
    return new GoogleOAuthError({
      reason: `Token exchange failed (${response.status})`,
    });
  }

  const json = await response
    .json()
    .then((value) => {
      // SAFETY: fetch json() is untyped; tokenResponseSchema is the Google contract.
      return value as unknown;
    })
    .catch(
      (e) =>
        new GoogleOAuthError({
          reason: "Token response was not JSON",
          cause: e,
        }),
    );
  if (json instanceof Error) return json;
  if (!Value.Check(tokenResponseSchema, json)) {
    return new GoogleOAuthError({ reason: "Token response was invalid" });
  }

  const grantedScopes = json.scope
    .split(" ")
    .filter((scope) => scope.length > 0);
  if (grantedScopes.length === 0) {
    return new GoogleOAuthError({ reason: "Token response had no scopes" });
  }

  const tokens: StoredTokens & { grantedScopes: string[] } = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAtMs:
      json.expires_in === undefined
        ? undefined
        : Date.now() + json.expires_in * 1000,
    tokenType: json.token_type,
    grantedScopes,
  };
  return tokens;
}
