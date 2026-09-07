import { expect } from "@playwright/test";
import path from "node:path";
import * as errore from "errore";
import type { PluginPackageJson } from "@halo/plugin-sdk/schema";
import { e2eTest } from "./e2eTest.js";

e2eTest.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

e2eTest(
  "builds an interactive plugin pane that runs in a standalone browser",
  async ({ harness, server }) => {
    const plugin = await server.rpc.plugins.create({ id: "greeting" });
    await harness.tools.files.write({
      path: path.join(plugin.directory, "Greeting.tsx"),
      content: `
        import { useState } from "react";
        import { Button, MauiProvider, TextField } from "maui";
        import { parseVersioned, Type } from "@get-halo/plugin-sdk/schema";
        import "./Greeting.css";

        const nameSchema = Type.String({ minLength: 1 });

        export default function Greeting() {
          const [name, setName] = useState("");
          const [greeting, setGreeting] = useState("");

          function greet() {
            const parsed = parseVersioned({
              name: "name", schema: nameSchema, value: name,
            });
            if (parsed instanceof Error) {
              setGreeting(parsed.message);
              return;
            }
            setGreeting("Hello, " + parsed + "!");
          }

          return (
            <MauiProvider>
              <main className="greeting">
                <TextField aria-label="Your name" value={name} onChange={setName} />
                <Button onClick={greet}>Greet</Button>
                <p role="status">{greeting}</p>
              </main>
            </MauiProvider>
          );
        }
      `,
    });
    await harness.tools.files.write({
      path: path.join(plugin.directory, "Greeting.css"),
      content: `.greeting { display: grid; gap: 24px; }`,
    });

    const manifestPath = path.join(plugin.directory, "package.json");
    const manifestSource = await harness.tools.files.read({
      path: manifestPath,
    });
    const manifest = errore.try({
      // SAFETY: plugins.create produced this package; retain its dependencies when updating halo.
      try: () => JSON.parse(manifestSource.text) as PluginPackageJson,
      catch: (cause) => new PluginManifestParseError({ cause }),
    });
    if (manifest instanceof Error) throw manifest;
    await harness.tools.files.write({
      path: manifestPath,
      content: JSON.stringify({
        ...manifest,
        halo: {
          ...manifest.halo,
          contributes: {
            sidebar: [],
            panes: [
              {
                id: "greeting",
                title: "Greeting",
                content: { kind: "webview", entry: "./Greeting.tsx" },
              },
            ],
          },
        },
      }),
    });

    await server.rpc.plugins.build();
    const listed = await server.rpc.plugins.list();
    const contribution = listed.contributions.find(
      (entry) => entry.pluginId === plugin.id,
    );
    const pane = contribution?.contributes.panes.find(
      (entry) => entry.id === "greeting",
    );
    expect(pane).toHaveProperty("url", expect.any(String));
    // @ts-expect-error -- Test-first: discovery does not expose pane URLs yet; the assertion above requires one.
    const browser = await server.rpc.browser.open({ url: pane!.url });
    const result = await server.rpc.browser.exec({
      id: browser.id,
      source: `
        await page.getByRole("textbox", { name: "Your name" }).fill("Ada");
        await page.getByRole("button", { name: "Greet", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "Hello, Ada!" }).waitFor();
        return {
          greeting: await page.getByRole("status").innerText(),
          gap: await page.getByRole("main").evaluate(element => getComputedStyle(element).rowGap),
        };
      `,
    });
    expect(result.result).toEqual({ greeting: "Hello, Ada!", gap: "24px" });
  },
);

class PluginManifestParseError extends errore.createTaggedError({
  name: "PluginManifestParseError",
  message: "Could not parse the scaffolded plugin manifest",
}) {}

e2eTest(
  "keeps an open plugin synced when another client opens it",
  async ({ harness, renderer, server }) => {
    await e2eTest.step("Create and open a storage plugin", async () => {
      await server.rpc.plugins.create({ id: "items", storage: true });
      expect(await server.rpc.plugins.build()).toEqual({
        built: ["items"],
        errors: [],
      });
      await renderer.page.reload();
      await renderer.page
        .getByRole("link", { name: "Home", exact: true })
        .click();
    });

    const userPane = renderer.page.getByRole("main", {
      name: "items",
      exact: true,
    });
    await e2eTest.step(
      "Add an item through the plugin's normal transaction hook",
      async () => {
        await userPane
          .getByRole("textbox", { name: "New item" })
          .fill("From the user");
        await userPane
          .getByRole("button", { name: "Add", exact: true })
          .click();
        await expect(
          userPane.getByRole("checkbox", { name: "From the user" }),
        ).toBeVisible();
      },
    );

    const agentPage = await harness.openWindow();
    await agentPage.getByRole("link", { name: "Home", exact: true }).click();
    const agentPane = agentPage.getByRole("main", {
      name: "items",
      exact: true,
    });
    await e2eTest.step(
      "The second view reads the same plugin data",
      async () => {
        await expect(
          agentPane.getByRole("checkbox", { name: "From the user" }),
        ).toBeVisible();
      },
    );

    await e2eTest.step("Add an item from the second view", async () => {
      await agentPane
        .getByRole("textbox", { name: "New item" })
        .fill("From the agent");
      await agentPane.getByRole("button", { name: "Add", exact: true }).click();
      await expect(
        agentPane.getByRole("checkbox", { name: "From the agent" }),
      ).toBeVisible();
    });

    await e2eTest.step(
      "The original view receives the change without reloading",
      async () => {
        await expect(
          userPane.getByRole("checkbox", { name: "From the agent" }),
        ).toBeVisible();
      },
    );
  },
);
