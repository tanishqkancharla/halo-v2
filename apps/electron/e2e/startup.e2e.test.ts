import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";

e2eTest("opens the saved workspace", async ({ renderer, server }) => {
  await expect(
    renderer.page.getByRole("main", { name: "New session" }),
  ).toBeVisible();
  await expect(
    renderer.page.getByRole("button", { name: "New session" }),
  ).toBeVisible();
  await expect(renderer.page.getByText(/^Halo \d+\.\d+\.\d+$/)).toBeVisible();

  expect(await server.rpc.workspace.get()).toMatchObject({
    workspaceRoot: server.harness.paths.workspace,
  });
});
