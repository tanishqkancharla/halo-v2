import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";

extensionE2eTest(
  "opens an interactive extension pane from the workspace sidebar",
  async ({ renderer, loadExtension }) => {
    await loadExtension("./fixtures/greeting");

    await renderer.page
      .getByRole("link", { name: "greeting", exact: true })
      .click({ timeout: 10_000 });

    const pane = renderer.page
      .getByTitle("greeting", { exact: true })
      .contentFrame();
    await pane.getByRole("textbox", { name: "Your name" }).fill("Ada");
    await pane.getByRole("button", { name: "Greet", exact: true }).click();
    await expect(pane.getByRole("status")).toHaveText("Hello, Ada!");
  },
);

extensionE2eTest(
  "syncs tasks from a separate browser into an open Halo pane without losing its draft",
  async ({ renderer, loadExtension, server, agentBrowser }) => {
    const loaded = await loadExtension(
      "../../../packages/extension-tools/test/fixtures/tasks",
    );
    await renderer.page
      .getByRole("link", { name: "tasks", exact: true })
      .click();
    const pane = renderer.page
      .getByTitle("tasks", { exact: true })
      .contentFrame();
    await pane.getByRole("textbox", { name: "New task" }).fill("My draft");

    const extensions = await server.rpc.extensions.list();
    const extension = extensions.find((entry) => entry.id === loaded.id)!;
    const agentPage = await agentBrowser.open(extension.url);
    await agentPage
      .getByRole("textbox", { name: "New task" })
      .fill("From the agent");
    await agentPage.getByRole("button", { name: "Add task" }).click();

    await expect(
      pane.getByRole("checkbox", { name: "From the agent" }),
    ).toBeVisible();
    await expect(pane.getByRole("textbox", { name: "New task" })).toHaveValue(
      "My draft",
    );
  },
);
