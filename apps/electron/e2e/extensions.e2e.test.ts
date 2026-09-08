import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";

extensionE2eTest.setTimeout(90_000);

extensionE2eTest(
  "runs the saved workspace's extensions until Halo quits",
  async ({ prepareExtension, launchApp, request }) => {
    const prepared = await prepareExtension("./fixtures/greeting");
    const { server, close } = await launchApp();
    const extensions = await server.rpc.extensions.list();
    const extension = extensions.find((entry) => entry.id === prepared.id)!;
    const browser = await server.rpc.browser.open({ url: extension.url });
    const view = await server.rpc.browser.snapshot({ id: browser.id });
    expect(view.tree).toContain("Your name");

    await close();

    await expect(
      request.get(extension.url, { timeout: 5_000 }),
    ).rejects.toThrow(/ECONNREFUSED/);
  },
);

extensionE2eTest(
  "keeps a newly loaded extension reachable across concurrent reloads",
  async ({ loadExtension, server }) => {
    const loaded = await loadExtension("./fixtures/greeting");
    const extensions = await server.rpc.extensions.list();
    const extension = extensions.find((entry) => entry.id === loaded.id)!;
    const browser = await server.rpc.browser.open({ url: extension.url });

    await Promise.all([
      server.rpc.extensions.reload(),
      server.rpc.extensions.reload(),
    ]);

    const view = await server.rpc.browser.exec({
      id: browser.id,
      source: `
        await page.reload();
        await page.getByRole("textbox", { name: "Your name" }).waitFor();
        return await page.getByRole("textbox", { name: "Your name" }).isVisible();
      `,
    });
    expect(view.result).toBe(true);
    expect(await server.rpc.extensions.list()).toEqual([extension]);
  },
);
