import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";

e2eTest.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

e2eTest(
  "keeps an open plugin synced when another client opens it",
  async ({ harness, renderer, server }) => {
    await e2eTest.step("Create and open a storage plugin", async () => {
      await server.rpc.plugins.create({ id: "items", storage: true });
      expect(await server.rpc.plugins.build()).toEqual({
        built: ["items"],
        errors: [],
      });
      await renderer.page.reload();
      await renderer.page
        .getByRole("link", { name: "Home", exact: true })
        .click();
    });

    const userPane = renderer.page.getByRole("main", {
      name: "items",
      exact: true,
    });
    await e2eTest.step(
      "Add an item through the plugin's normal transaction hook",
      async () => {
        await userPane
          .getByRole("textbox", { name: "New item" })
          .fill("From the user");
        await userPane
          .getByRole("button", { name: "Add", exact: true })
          .click();
        await expect(
          userPane.getByRole("checkbox", { name: "From the user" }),
        ).toBeVisible();
      },
    );

    const agentPage = await harness.openWindow();
    await agentPage.getByRole("link", { name: "Home", exact: true }).click();
    const agentPane = agentPage.getByRole("main", {
      name: "items",
      exact: true,
    });
    await e2eTest.step(
      "The second view reads the same plugin data",
      async () => {
        await expect(
          agentPane.getByRole("checkbox", { name: "From the user" }),
        ).toBeVisible();
      },
    );

    await e2eTest.step("Add an item from the second view", async () => {
      await agentPane
        .getByRole("textbox", { name: "New item" })
        .fill("From the agent");
      await agentPane.getByRole("button", { name: "Add", exact: true }).click();
      await expect(
        agentPane.getByRole("checkbox", { name: "From the agent" }),
      ).toBeVisible();
    });

    await e2eTest.step(
      "The original view receives the change without reloading",
      async () => {
        await expect(
          userPane.getByRole("checkbox", { name: "From the agent" }),
        ).toBeVisible();
      },
    );
  },
);
