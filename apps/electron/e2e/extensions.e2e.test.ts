import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";

extensionE2eTest.setTimeout(90_000);

extensionE2eTest(
  "runs the saved workspace's extensions until Halo quits",
  async ({ prepareExtension, launchApp, agentBrowser, request }) => {
    const prepared = await prepareExtension("./fixtures/greeting");
    const { server, close } = await launchApp();
    const extensions = await server.rpc.extensions.list();
    const extension = extensions.find((entry) => entry.id === prepared.id)!;
    const page = await agentBrowser.open(extension.url);
    await expect(
      page.getByRole("textbox", { name: "Your name" }),
    ).toBeVisible();

    await close();

    await expect(
      request.get(extension.url, { timeout: 5_000 }),
    ).rejects.toThrow(/ECONNREFUSED/);
  },
);
