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
