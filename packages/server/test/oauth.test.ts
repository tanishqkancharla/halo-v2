import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

function callbackUrl(server: { host: string; port: number }, search = "") {
  return `http://${server.host}:${server.port}/oauth/callback${search}`;
}

serverTest("rejects non-GET OAuth callback requests", async ({ server }) => {
  const response = await fetch(callbackUrl(server), { method: "POST" });
  expect(response.status).toBe(405);
  expect(await response.text()).toBe("");
});

serverTest("requires state and code parameters", async ({ server }) => {
  const response = await fetch(callbackUrl(server));
  expect(response.status).toBe(400);
  expect(await response.text()).toBe("Missing OAuth callback parameters.");
});

serverTest("reports a provider error as not completed", async ({ server }) => {
  const response = await fetch(callbackUrl(server, "?error=access_denied"));
  expect(response.status).toBe(400);
  expect(await response.text()).toBe("Authorization was not completed.");
});

serverTest(
  "reports a provider error with state as not completed",
  async ({ server }) => {
    const response = await fetch(
      callbackUrl(server, "?error=access_denied&state=unknown"),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Authorization was not completed.");
  },
);

serverTest(
  "reports a genuine OAuth authorization failure as not completed",
  async ({ server }) => {
    const response = await fetch(
      callbackUrl(server, "?state=unknown&code=dummy"),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Authorization could not be completed.");
  },
);
