import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";

extensionE2eTest(
  "reads workspace notes through a trusted extension tool",
  async ({ app, loadExtension, harness }) => {
    await loadExtension("./fixtures/workspaceNotes");
    await app.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = app.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();

    await harness.tools.files.write({
      path: "notes.txt",
      content: "Discuss the extension tool bridge on Friday.",
    });
    await pane.getByRole("button", { name: "Refresh notes" }).click();

    await expect(pane.getByRole("status")).toHaveText(
      "Discuss the extension tool bridge on Friday.",
    );
  },
);

extensionE2eTest(
  "keeps extension tool access after restarting Halo",
  async ({ loadExtension, app, harness }) => {
    await loadExtension("./fixtures/workspaceNotes");
    await harness.tools.files.write({
      path: "notes.txt",
      content: "Available after restart",
    });
    await app.quit();
    await app.open();
    await app.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = app.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();
    await pane.getByRole("button", { name: "Refresh notes" }).click();

    await expect(pane.getByRole("status")).toHaveText(
      "Available after restart",
    );
  },
);
