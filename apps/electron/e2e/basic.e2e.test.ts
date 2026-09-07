import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
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
    content: "Original",
  });

  await renderer.page.getByRole("link", { name: "notes.md" }).click();
  const filePane = renderer.page.getByRole("main", { name: "notes.md" });
  const editor = filePane.getByLabel("notes.md", { exact: true });
  await expect(editor).toHaveText("Original");
  await editor.fill("Edited in Halo");

  await expect
    .poll(() => server.rpc.workspace.readFile({ path: "notes.md" }))
    .toContain("Edited in Halo");

  await expect(filePane.getByTestId("autosave-error")).toBeHidden();
});

// Use the Linux immutable-file flag (chattr -f +i) to make a file unwritable
// even for the root test runner, then clear it with chattr -f -i. Reads still
// work, so the cache invalidation can refetch the disk's true content.
function makeFileImmutable(filePath: string) {
  execSync(`chattr -f +i ${JSON.stringify(filePath)}`);
}
function makeFileMutable(filePath: string) {
  execSync(`chattr -f -i ${JSON.stringify(filePath)}`);
}

e2eTest(
  "surfaces and recovers from a failed markdown autosave",
  async ({ renderer, server, harness }) => {
    test.setTimeout(60_000);
    await server.rpc.workspace.writeFile({
      path: "notes.md",
      content: "Original",
    });
    await renderer.page.getByRole("link", { name: "notes.md" }).click();
    const filePane = renderer.page.getByRole("main", { name: "notes.md" });
    const editor = filePane.getByLabel("notes.md", { exact: true });
    await expect(editor).toHaveText("Original");

    const diskPath = path.join(harness.paths.workspace, "notes.md");
    makeFileImmutable(diskPath);
    try {
      await editor.fill("Edited in Halo");
      await expect(filePane.getByTestId("autosave-error")).toBeVisible({
        timeout: 5_000,
      });
      await expect(filePane.getByTestId("autosave-error")).toHaveText(
        /Failed to write notes\.md/,
      );
      // Disk still holds the pre-failure content.
      await expect
        .poll(() => server.rpc.workspace.readFile({ path: "notes.md" }))
        .toBe("Original");
      // lastWritten rolled back to "Original"; the cache was invalidated and
      // refetched disk truth; the Editor re-synced content. The buffer
      // reverted, so the user sees disk's content, not the rejected value.
      await expect(editor).toHaveText("Original", { timeout: 5_000 });
    } finally {
      makeFileMutable(diskPath);
    }

    // Recovery: a fresh edit clears the error and writes successfully.
    await editor.fill("Recovery");
    await expect(filePane.getByTestId("autosave-error")).toBeHidden({
      timeout: 5_000,
    });
    await expect
      .poll(() => server.rpc.workspace.readFile({ path: "notes.md" }))
      .toBe("Recovery");

    // Remount: navigate away and back. Cache must reflect disk truth, not a
    // stale optimistic value.
    await renderer.page.getByRole("button", { name: "New session" }).click();
    await renderer.page.getByRole("link", { name: "notes.md" }).click();
    await expect(
      renderer.page
        .getByRole("main", { name: "notes.md" })
        .getByLabel("notes.md", { exact: true }),
    ).toHaveText("Recovery");
    await expect(
      renderer.page
        .getByRole("main", { name: "notes.md" })
        .getByTestId("autosave-error"),
    ).toBeHidden();
  },
);

e2eTest(
  "surfaces a failed code autosave",
  async ({ renderer, server, harness }) => {
    test.setTimeout(60_000);
    await server.rpc.workspace.writeFile({
      path: "snippet.ts",
      content: "const a = 1;\n",
    });
    await renderer.page.getByRole("link", { name: "snippet.ts" }).click();
    const filePane = renderer.page.getByRole("main", { name: "snippet.ts" });
    await expect(filePane).toBeVisible();

    const diskPath = path.join(harness.paths.workspace, "snippet.ts");
    makeFileImmutable(diskPath);
    try {
      // CodeView does not expose an accessible label we can fill directly;
      // click into the editor and type to arm an autosave.
      await filePane.click();
      await renderer.page.keyboard.type("const b = 2;\n");
      await expect(filePane.getByTestId("autosave-error")).toBeVisible({
        timeout: 5_000,
      });
      await expect(filePane.getByTestId("autosave-error")).toHaveText(
        /Failed to write snippet\.ts/,
      );
      // Disk still holds the pre-failure content.
      await expect
        .poll(() => server.rpc.workspace.readFile({ path: "snippet.ts" }))
        .toBe("const a = 1;\n");
    } finally {
      makeFileMutable(diskPath);
    }
  },
);

e2eTest(
  "does not silently lose a failed tail edit",
  async ({ renderer, server, harness }) => {
    test.setTimeout(60_000);
    await server.rpc.workspace.writeFile({
      path: "tail.md",
      content: "old",
    });
    await renderer.page.getByRole("link", { name: "tail.md" }).click();
    const filePane = renderer.page.getByRole("main", { name: "tail.md" });
    const editor = filePane.getByLabel("tail.md", { exact: true });
    await expect(editor).toHaveText("old");

    const diskPath = path.join(harness.paths.workspace, "tail.md");
    makeFileImmutable(diskPath);
    try {
      await editor.fill("new");
      // The failed tail write is visible to the user, not silent.
      await expect(filePane.getByTestId("autosave-error")).toBeVisible({
        timeout: 5_000,
      });
      // Disk still holds the pre-failure content.
      await expect
        .poll(() => server.rpc.workspace.readFile({ path: "tail.md" }))
        .toBe("old");
    } finally {
      makeFileMutable(diskPath);
    }

    // Navigate away and back without further edits. The remount reads the
    // reconciled cache (disk truth), not the rejected optimistic value.
    await renderer.page.getByRole("button", { name: "New session" }).click();
    await renderer.page.getByRole("link", { name: "tail.md" }).click();
    const remounted = renderer.page.getByRole("main", { name: "tail.md" });
    await expect(remounted.getByLabel("tail.md", { exact: true })).toHaveText(
      "old",
    );
    await expect(remounted.getByTestId("autosave-error")).toBeHidden();
  },
);

e2eTest(
  "an exact-identical retype of a rejected value retries the write",
  async ({ renderer, server, harness }) => {
    test.setTimeout(60_000);
    await server.rpc.workspace.writeFile({
      path: "retry.md",
      content: "old",
    });
    await renderer.page.getByRole("link", { name: "retry.md" }).click();
    const filePane = renderer.page.getByRole("main", { name: "retry.md" });
    const editor = filePane.getByLabel("retry.md", { exact: true });
    await expect(editor).toHaveText("old");

    const diskPath = path.join(harness.paths.workspace, "retry.md");
    makeFileImmutable(diskPath);
    try {
      await editor.fill("new");
      await expect(filePane.getByTestId("autosave-error")).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      makeFileMutable(diskPath);
    }

    // Re-type the exact same value that just failed. lastWritten rolled back
    // to "old", so onChange does not short-circuit and a new write is armed.
    await editor.fill("new");
    await expect(filePane.getByTestId("autosave-error")).toBeHidden({
      timeout: 5_000,
    });
    await expect
      .poll(() => server.rpc.workspace.readFile({ path: "retry.md" }))
      .toBe("new");
  },
);
