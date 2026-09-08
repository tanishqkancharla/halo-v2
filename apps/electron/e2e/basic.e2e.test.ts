import fs from "node:fs/promises";
import nodePath from "node:path";
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

e2eTest(
  "creates and organizes notes through the Files sidebar",
  async ({ renderer, server }) => {
    const page = renderer.page;
    await page
      .getByRole("button", { name: "New file or folder", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "New folder…", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "New folder", exact: true })
      .getByRole("textbox", { name: "Name" })
      .fill("Notes");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page
      .getByRole("button", { name: "Actions for Notes", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "New file…", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "New file", exact: true })
      .getByRole("textbox", { name: "Name" })
      .fill("Today.md");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const editor = page
      .getByRole("main", { name: "Notes/Today.md", exact: true })
      .getByLabel("Notes/Today.md", { exact: true });
    await editor.fill("My latest edit");

    await page
      .getByRole("button", { name: "Actions for Today.md", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Rename…", exact: true }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Plan.md");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(
      page.getByRole("main", { name: "Notes/Plan.md", exact: true }),
    ).toContainText("My latest edit");

    await page
      .getByRole("button", { name: "Actions for Plan.md", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Move to…", exact: true }).click();
    await page.getByRole("button", { name: /Move to$/ }).click();
    await page.getByRole("option", { name: "Workspace", exact: true }).click();
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect(
      page.getByRole("main", { name: "Plan.md", exact: true }),
    ).toContainText("My latest edit");
    expect(await server.rpc.workspace.readFile({ path: "Plan.md" })).toContain(
      "My latest edit",
    );
    expect(await server.rpc.workspace.listPaths()).toEqual([
      "Notes/",
      "Plan.md",
    ]);

    await page
      .getByRole("button", { name: "New file or folder", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "New file…", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Name" }).fill("Plan.md");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "already exists",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("main", { name: "Plan.md", exact: true }),
    ).toContainText("My latest edit");
  },
);

e2eTest(
  "moves folders by dragging and keeps the open note selected",
  async ({ renderer, server }) => {
    await server.rpc.workspace.writeFile({
      path: "Notes/Today.md",
      content: "A note to move",
    });
    await server.rpc.workspace.createEntry({
      path: "Archive",
      kind: "directory",
    });
    const page = renderer.page;
    await page
      .getByRole("button", { name: "Expand Notes", exact: true })
      .click();
    await page.getByRole("link", { name: "Today.md", exact: true }).click();
    await page
      .getByRole("main", { name: "Notes/Today.md", exact: true })
      .getByLabel("Notes/Today.md", { exact: true })
      .fill("Edited before dragging");
    await page
      .locator('[data-file-path="Notes"]')
      .dragTo(page.locator('[data-file-path="Archive"]'));
    await expect(
      page.getByRole("main", { name: "Archive/Notes/Today.md", exact: true }),
    ).toContainText("Edited before dragging");
    await expect(
      page.getByRole("button", { name: "Actions for Today.md", exact: true }),
    ).toBeVisible();
    expect(await server.rpc.workspace.listPaths()).toEqual([
      "Archive/Notes/Today.md",
    ]);
    await page.reload();
    await expect(
      page.getByRole("main", { name: "Archive/Notes/Today.md", exact: true }),
    ).toContainText("Edited before dragging");
  },
);

e2eTest(
  "keeps unsaved edits when a rename cannot save, then retries after repair",
  async ({ renderer, server, harness }) => {
    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Original",
    });
    const page = renderer.page;
    await page.getByRole("link", { name: "notes.md", exact: true }).click();
    const editor = page
      .getByRole("main", { name: "notes.md", exact: true })
      .getByLabel("notes.md", { exact: true });
    await expect(editor).toHaveText("Original");
    const file = nodePath.join(harness.paths.workspace, "notes.md");
    await fs.unlink(file);
    await fs.mkdir(file);
    await editor.fill("Keep this unsaved edit");
    await page
      .getByRole("button", { name: "Actions for notes.md", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Rename…", exact: true }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("renamed.md");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Failed to save notes.md",
    );
    await fs.rmdir(file);
    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Original",
    });
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(
      page.getByRole("main", { name: "renamed.md", exact: true }),
    ).toContainText("Keep this unsaved edit");
    expect(await server.rpc.workspace.listPaths()).toEqual(["renamed.md"]);
    expect(
      await server.rpc.workspace.readFile({ path: "renamed.md" }),
    ).toContain("Keep this unsaved edit");
  },
);
