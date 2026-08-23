import { describe, expect, test } from "vitest";
import {
  GoogleOAuthError,
  HALO_GOOGLE_OAUTH_CLIENT_ID,
  runGoogleLoopbackOAuth,
} from "./GoogleOAuth.js";

const gmailReadonly = "https://www.googleapis.com/auth/gmail.readonly";

describe("runGoogleLoopbackOAuth", () => {
  test("opens Google in the default-browser URL and treats cancel as an error", async () => {
    let authorizeUrl = "";
    const result = await runGoogleLoopbackOAuth({
      scopes: [gmailReadonly],
      openUrl: async (url) => {
        authorizeUrl = url;
        const parsed = new URL(url);
        const redirectUri = parsed.searchParams.get("redirect_uri");
        const state = parsed.searchParams.get("state");
        if (redirectUri === null || state === null) {
          throw new Error("Authorize URL missing redirect or state");
        }
        const response = await fetch(
          `${redirectUri}?error=access_denied&state=${state}`,
        );
        if (!response.ok) {
          throw new Error(`Loopback reply ${response.status}`);
        }
        const html = await response.text();
        if (!html.includes("You can close this tab")) {
          throw new Error("Loopback HTML missing close message");
        }
      },
    });

    expect(result).toBeInstanceOf(GoogleOAuthError);
    const parsed = new URL(authorizeUrl);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(parsed.searchParams.get("client_id")).toBe(
      HALO_GOOGLE_OAUTH_CLIENT_ID,
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("include_granted_scopes")).toBe("true");
    expect(parsed.searchParams.get("scope")).toBe(gmailReadonly);
    expect(parsed.searchParams.get("redirect_uri")).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/$/,
    );
    expect(parsed.searchParams.has("client_secret")).toBe(false);
  });

  test("rejects a redirect with the wrong state", async () => {
    const result = await runGoogleLoopbackOAuth({
      scopes: [gmailReadonly],
      openUrl: async (url) => {
        const parsed = new URL(url);
        const redirectUri = parsed.searchParams.get("redirect_uri");
        if (redirectUri === null) {
          throw new Error("Authorize URL missing redirect");
        }
        await fetch(`${redirectUri}?code=fake&state=wrong`);
      },
    });

    expect(result).toBeInstanceOf(GoogleOAuthError);
    if (result instanceof GoogleOAuthError) {
      expect(result.reason).toBe("OAuth state mismatch");
    }
  });
});
