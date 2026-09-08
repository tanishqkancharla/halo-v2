import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";

extensionE2eTest(
  "reads workspace notes through a granted extension tool",
  async ({ app, loadExtension, harness }) => {
    await loadExtension("./fixtures/workspaceNotes");

    const requested = await harness.tools.bash.run({
      command: "halo extension tools add workspaceNotes files.read",
    });
    expect(requested.code, `${requested.stdout}\n${requested.stderr}`).toBe(0);
    await app.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .waitFor();
    await app.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = app.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();
    await app.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .getByRole("button", { name: "Allow access", exact: true })
      .click();

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
  "revoking tool access takes effect in an already-open extension",
  async ({ app, loadExtension, harness }) => {
    await loadExtension("./fixtures/workspaceNotes");
    await harness.tools.files.write({
      path: "notes.txt",
      content: "Workspace notes",
    });
    await app.server.rpc.extensions.tools.add({
      id: "workspaceNotes",
      paths: ["files.read"],
    });
    await app.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .getByRole("button", { name: "Allow access", exact: true })
      .click();
    await app.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = app.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();

    await app.page
      .getByRole("main", { name: "workspaceNotes", exact: true })
      .getByRole("button", { name: "Permissions", exact: true })
      .click();
    await app.page
      .getByRole("button", { name: "Revoke files.read", exact: true })
      .click();
    await expect(
      app.page.getByRole("button", {
        name: "Revoke files.read",
        exact: true,
      }),
    ).toHaveCount(0);
    await app.page
      .getByRole("dialog", { name: "Permissions for workspaceNotes" })
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await pane.getByRole("button", { name: "Refresh notes" }).click();

    await expect(pane.getByRole("alert")).toHaveText(
      "Could not read workspace notes",
    );
  },
);

extensionE2eTest(
  "remembers tool approval after restarting Halo",
  async ({ loadExtension, app, harness }) => {
    await loadExtension("./fixtures/workspaceNotes");
    await harness.tools.files.write({
      path: "notes.txt",
      content: "Available after restart",
    });
    await app.server.rpc.extensions.tools.add({
      id: "workspaceNotes",
      paths: ["files.read"],
    });
    await app.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .getByRole("button", { name: "Allow access", exact: true })
      .click();
    await expect(
      app.page.getByRole("region", {
        name: "Permissions for workspaceNotes",
      }),
    ).toHaveCount(0);

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
