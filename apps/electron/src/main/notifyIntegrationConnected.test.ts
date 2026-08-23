import { describe, expect, test } from "vitest";
import {
  integrationConnectedEventText,
  integrationDisconnectedEventText,
} from "./notifyIntegrationConnected.js";

describe("integrationConnectedEventText", () => {
  test("names Gmail, lists scopes, and points at integrations_run", () => {
    const text = integrationConnectedEventText({
      id: "conn-gmail",
      service: "gmail",
      profile: "default",
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      status: "connected",
      intent: undefined,
    });

    expect(text.startsWith("[System] The user connected Gmail")).toBe(true);
    expect(text).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(text).toContain("integrations_run");
    expect(text).toContain('service "gmail"');
  });
});

describe("integrationDisconnectedEventText", () => {
  test("names Gmail and says run will fail until reconnect", () => {
    const text = integrationDisconnectedEventText("gmail");

    expect(text.startsWith("[System] The user disconnected Gmail")).toBe(true);
    expect(text).toContain('service "gmail"');
  });
});
