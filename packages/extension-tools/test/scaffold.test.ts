import { expect } from "@playwright/test";
import { extensionTest } from "./extensionTest.js";

extensionTest(
  "runs the generated starter without source edits",
  async ({ loadExtension, page }) => {
    const extension = await loadExtension();
    await page.goto(extension.url);
    await expect(
      page.getByRole("heading", { name: "Hello, extension" }),
    ).toBeVisible();
  },
);
