import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";

extensionE2eTest.setTimeout(90_000);

extensionE2eTest(
  "runs the saved workspace's extensions until Halo quits",
  async ({ server, agentBrowser, closeApp, request }) => {
    const extensions = await server.rpc.extensions.list();
    const extension = extensions.find((entry) => entry.id === "starter")!;
    const page = await agentBrowser.open(extension.url);
    await expect(
      page.getByRole("heading", { name: "Hello, extension" }),
    ).toBeVisible();

    await closeApp();

    await expect(
      request.get(extension.url, { timeout: 5_000 }),
    ).rejects.toThrow(/ECONNREFUSED/);
  },
);
