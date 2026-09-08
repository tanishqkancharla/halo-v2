import { expect } from "@playwright/test";
import { extensionE2eTest } from "./extensionE2eTest.js";
import { createHarnessTools } from "./tools.js";

extensionE2eTest(
  "reads workspace notes through a granted extension tool",
  async ({ renderer, loadExtension, harness }) => {
    await loadExtension("./fixtures/workspaceNotes");

    const requested = await harness.tools.bash.run({
      command: "halo extension tools add workspaceNotes files.read",
    });
    expect(requested.code, `${requested.stdout}\n${requested.stderr}`).toBe(0);
    await renderer.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .waitFor();
    await renderer.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = renderer.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();
    await renderer.page
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
  async ({ renderer, loadExtension, harness, server }) => {
    await loadExtension("./fixtures/workspaceNotes");
    await harness.tools.files.write({
      path: "notes.txt",
      content: "Workspace notes",
    });
    await server.rpc.extensions.tools.add({
      id: "workspaceNotes",
      paths: ["files.read"],
    });
    await renderer.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .getByRole("button", { name: "Allow access", exact: true })
      .click();
    await renderer.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = renderer.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();

    await renderer.page
      .getByRole("main", { name: "workspaceNotes", exact: true })
      .getByRole("button", { name: "Permissions", exact: true })
      .click();
    await renderer.page
      .getByRole("button", { name: "Revoke files.read", exact: true })
      .click();
    await expect(
      renderer.page.getByRole("button", {
        name: "Revoke files.read",
        exact: true,
      }),
    ).toHaveCount(0);
    await renderer.page
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
  async ({ prepareExtension, launchApp }) => {
    await prepareExtension("./fixtures/workspaceNotes");
    const first = await launchApp();
    await createHarnessTools(first.server.rpc).files.write({
      path: "notes.txt",
      content: "Available after restart",
    });
    await first.server.rpc.extensions.tools.add({
      id: "workspaceNotes",
      paths: ["files.read"],
    });
    await first.renderer.page
      .getByRole("region", { name: "Permissions for workspaceNotes" })
      .getByRole("button", { name: "Allow access", exact: true })
      .click();
    await expect(
      first.renderer.page.getByRole("region", {
        name: "Permissions for workspaceNotes",
      }),
    ).toHaveCount(0);

    await first.close();
    const second = await launchApp();
    await second.renderer.page
      .getByRole("link", { name: "workspaceNotes", exact: true })
      .click();
    const pane = second.renderer.page
      .getByTitle("workspaceNotes", { exact: true })
      .contentFrame();
    await pane.getByRole("button", { name: "Refresh notes" }).click();

    await expect(pane.getByRole("status")).toHaveText(
      "Available after restart",
    );
  },
);
