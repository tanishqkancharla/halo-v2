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

e2eTest("keeps the current file after reload", async ({ renderer, server }) => {
  const path = "Meeting notes #1.md";
  await server.rpc.workspace.writeFile({ path, content: "# Meeting notes" });
  await renderer.page.getByRole("link", { name: path }).click();
  const filePane = renderer.page.getByRole("main", { name: path });
  await expect(filePane.getByLabel(path, { exact: true })).toHaveText(
    "Meeting notes",
  );

  await renderer.page.reload();

  await expect(filePane).toBeVisible();
  await expect(filePane.getByLabel(path, { exact: true })).toHaveText(
    "Meeting notes",
  );
});

e2eTest(
  "places the markdown cursor at the end when clicking below the text",
  async ({ renderer, server }) => {
    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "# Title\n\nLast line",
    });

    await renderer.page.getByRole("link", { name: "notes.md" }).click();
    const filePane = renderer.page.getByRole("main", { name: "notes.md" });
    const editor = filePane.getByLabel("notes.md", { exact: true });
    await editor.getByRole("heading", { name: "Title" }).click();
    const pageContent = filePane.getByTestId("file-page-content");
    const size = await pageContent.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    }));
    await pageContent.click({
      position: { x: size.width / 2, y: size.height - 20 },
    });

    await expect(editor).toBeFocused();
    await renderer.page.keyboard.type(" appended");
    await expect(
      editor.getByText("Last line appended", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => server.rpc.workspace.readFile({ path: "notes.md" }))
      .toContain("Last line appended");
  },
);
