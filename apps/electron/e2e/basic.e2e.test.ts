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
    await page.getByRole("button", { name: "New folder", exact: true }).click();
    const folderName = page.getByRole("textbox", { name: "New folder name" });
    await folderName.fill("Notes");
    await folderName.press("Enter");
    await page
      .getByRole("button", { name: "Actions for Notes", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "New file…", exact: true })
      .click();
    const fileName = page.getByRole("textbox", { name: "New file name" });
    await fileName.fill("Today.md");
    await fileName.press("Enter");
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

    await page.getByRole("button", { name: "New file", exact: true }).click();
    await fileName.fill("Plan.md");
    await fileName.press("Enter");
    await expect(page.getByRole("alert")).toContainText("already exists");
    await fileName.press("Escape");
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

e2eTest(
  "confirms folder deletion and closes its open file",
  async ({ renderer, server }) => {
    await server.rpc.workspace.writeFile({
      path: "Notes/Today.md",
      content: "# Today",
    });
    await server.rpc.workspace.writeFile({
      path: "Keep.md",
      content: "# Keep",
    });
    const page = renderer.page;
    await page
      .getByRole("button", { name: "Expand Notes", exact: true })
      .click();
    await page.getByRole("link", { name: "Today.md", exact: true }).click();
    const editor = page
      .getByRole("main", { name: "Notes/Today.md" })
      .getByLabel("Notes/Today.md", { exact: true });
    await editor.fill("Latest edit");
    await page
      .getByRole("button", { name: "Actions for Notes", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Delete…", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(editor).toBeVisible();
    await page
      .getByRole("button", { name: "Actions for Notes", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Delete…", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("main", { name: "New session" })).toBeVisible();
    await expect
      .poll(() => server.rpc.workspace.listPaths())
      .toEqual(["Keep.md"]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Actions for Notes", exact: true }),
    ).toHaveCount(0);
  },
);

e2eTest(
  "edits plain text and displays an image preview",
  async ({ renderer, server }) => {
    await server.rpc.workspace.writeFile({
      path: "notes.txt",
      content: "Plain text",
    });
    await server.rpc.workspace.writeFile({
      path: "picture.svg",
      content:
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="blue"/></svg>',
    });
    const page = renderer.page;
    await page.getByRole("link", { name: "notes.txt", exact: true }).click();
    const editor = page.getByRole("textbox", {
      name: "notes.txt",
      exact: true,
    });
    await expect(editor).toHaveValue("Plain text");
    await editor.fill("Saved plain text");
    await expect
      .poll(() => server.rpc.workspace.readFile({ path: "notes.txt" }))
      .toBe("Saved plain text");
    await page.getByRole("link", { name: "picture.svg", exact: true }).click();
    const image = page.getByRole("img", { name: "picture.svg", exact: true });
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBe(80);
    await page.getByRole("link", { name: "notes.txt", exact: true }).click();
    await expect(editor).toHaveValue("Saved plain text");
  },
);

e2eTest(
  "renders a PDF with the built-in document viewer",
  async ({ renderer, harness }) => {
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    const stream = "BT /F1 20 Tf 30 240 Td (Halo PDF preview) Tj ET";
    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    pdf += offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("");
    pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    await fs.writeFile(
      nodePath.join(harness.paths.workspace, "document.pdf"),
      pdf,
    );
    const page = renderer.page;
    await page.getByRole("link", { name: "document.pdf", exact: true }).click();
    const viewerUrl = /^chrome-extension:\/\/.*\/index.html$/;
    await expect
      .poll(() => page.frames().some((frame) => viewerUrl.test(frame.url())))
      .toBe(true);
    const viewer = page.frame({ url: viewerUrl });
    if (viewer === null) throw new Error("PDF viewer did not open");
    await expect(
      viewer.getByRole("textbox", { name: "Page number", exact: true }),
    ).toHaveValue("1");
    await expect(
      page.getByRole("button", { name: "Open externally", exact: true }),
    ).toBeVisible();
  },
);

e2eTest(
  "plays audio and explains unsupported binary files",
  async ({ renderer, harness }) => {
    const wav = Buffer.alloc(44 + 16000);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(16000, 40);
    await fs.writeFile(
      nodePath.join(harness.paths.workspace, "recording.wav"),
      wav,
    );
    await fs.writeFile(
      nodePath.join(harness.paths.workspace, "archive.zip"),
      Buffer.from([80, 75, 0, 255]),
    );
    const page = renderer.page;
    await page
      .getByRole("link", { name: "recording.wav", exact: true })
      .click();
    const player = page.locator('audio[aria-label="recording.wav"]');
    await expect(player).toBeVisible();
    await expect
      .poll(() =>
        player.evaluate((element: HTMLAudioElement) => element.duration),
      )
      .toBe(1);
    await page.getByRole("link", { name: "archive.zip", exact: true }).click();
    await expect(
      page.getByText(
        "This file type has no preview. Open it in its default app.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open externally", exact: true }),
    ).toBeEnabled();
  },
);

e2eTest(
  "names new files inline, preserves extensions, and cancels with Escape",
  async ({ renderer, server }) => {
    const page = renderer.page;
    await page.getByRole("button", { name: "New file", exact: true }).click();
    const name = page.getByRole("textbox", { name: "New file name" });
    await expect(name).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await name.fill("discard.txt");
    await name.press("Escape");
    await expect(name).toHaveCount(0);
    expect(await server.rpc.workspace.listPaths()).toEqual([]);
    await page.getByRole("button", { name: "New file", exact: true }).click();
    await name.fill("notes.txt");
    await page.getByText("Files", { exact: true }).click();
    await expect(
      page.getByRole("main", { name: "notes.txt", exact: true }),
    ).toBeVisible();
    expect(await server.rpc.workspace.listPaths()).toEqual(["notes.txt"]);
    await page.getByRole("button", { name: "New folder", exact: true }).click();
    const folder = page.getByRole("textbox", { name: "New folder name" });
    await folder.fill("Archive");
    await folder.press("Enter");
    await expect(folder).toHaveCount(0);
    await page
      .locator('[data-file-path="notes.txt"]')
      .dragTo(page.locator('[data-file-path="Archive"]'));
    await expect(
      page.getByRole("main", { name: "Archive/notes.txt", exact: true }),
    ).toBeVisible();
    expect(await server.rpc.workspace.listPaths()).toEqual([
      "Archive/notes.txt",
    ]);
  },
);
