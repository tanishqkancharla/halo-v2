import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";

e2eTest(
  "shows files inside a populated directory moved into the workspace",
  async ({ harness, renderer, server }) => {
    // Seed an existing file so the Files section is mounted before the move.
    await server.rpc.workspace.writeFile({
      path: "readme.md",
      content: "# Workspace",
    });
    await expect(
      renderer.page.getByRole("link", { name: "readme.md" }),
    ).toBeVisible();

    // Build a populated directory outside the workspace (same filesystem, so
    // the move is an atomic rename that @parcel/watcher's inotify backend
    // coalesces into a single directory create — the bug trigger).
    const src = path.join(harness.paths.root, "imported-src");
    await fs.mkdir(path.join(src, "deep"), { recursive: true });
    await fs.writeFile(path.join(src, "in.txt"), "x");
    await fs.writeFile(path.join(src, "deep", "note.md"), "y");

    await fs.rename(src, path.join(harness.paths.workspace, "imported"));

    // Source of truth: the on-demand list surfaces the moved-in files (the
    // bug left them out entirely).
    await expect
      .poll(() => server.rpc.workspace.listPaths())
      .toEqual(
        expect.arrayContaining(["imported/in.txt", "imported/deep/note.md"]),
      );

    // The directory appears in the sidebar Files tree and is NOT an empty
    // folder — the fix enumerates the contents, so children arrive as create
    // events and the directory renders with a chevron to expand.
    await expect(
      renderer.page.getByRole("link", { name: "imported" }),
    ).toBeVisible();

    // Expand the top-level directory to reveal its direct children.
    await renderer.page
      .getByRole("button", { name: "Expand imported" })
      .click();
    await expect(
      renderer.page.getByRole("link", { name: "in.txt" }),
    ).toBeVisible();

    // Expand the nested subdirectory to reveal its file.
    await renderer.page.getByRole("button", { name: "Expand deep" }).click();
    await expect(
      renderer.page.getByRole("link", { name: "note.md" }),
    ).toBeVisible();
  },
);
