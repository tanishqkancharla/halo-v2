import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";
import { m } from "./SessionDescription.js";

e2eTest("shows a connection request", async ({ harness, renderer }) => {
  await harness.loadSession({
    title: "Drive search",
    messages: [
      m.user("Find my planning document"),
      m.connectionRequest({
        client: "google",
        clientOwner: "org",
        owner: "user",
        connectionName: "default",
        integration: "google_drive",
        template: "google",
      }),
    ],
  });

  const card = renderer.page.getByRole("region", {
    name: "Google Drive connection",
  });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Connect" })).toBeVisible();
});
