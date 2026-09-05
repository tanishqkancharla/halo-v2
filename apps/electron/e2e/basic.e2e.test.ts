import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";

e2eTest("opens the saved workspace", async ({ harness, renderer, server }) => {
  await expect(
    renderer.page.getByRole("main", { name: "New session" }),
  ).toBeVisible();
  await expect(
    renderer.page.getByRole("button", { name: "New session" }),
  ).toBeVisible();
  await expect(renderer.page.getByText(/^Halo \d+\.\d+\.\d+$/)).toBeVisible();

  expect(await server.rpc.workspace.get()).toMatchObject({
    workspaceRoot: harness.paths.workspace,
  });
});

e2eTest("edits and saves a workspace note", async ({ renderer, server }) => {
  await server.rpc.workspace.writeFile({
    path: "notes.md",
    content: "# Original",
  });

  await renderer.page.getByRole("link", { name: "notes.md" }).click();
  const filePane = renderer.page.getByRole("main", { name: "notes.md" });
  const editor = filePane.getByLabel("notes.md", { exact: true });
  await expect(editor).toHaveText("Original");
  await editor.fill("Edited in Halo");

  await expect
    .poll(() => server.rpc.workspace.readFile({ path: "notes.md" }))
    .toContain("Edited in Halo");
});
