import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";

e2eTest(
  "authors and loads an extension through the agent's shell and file tools",
  async ({ harness, app }) => {
    e2eTest.setTimeout(120_000);
    const created = await harness.tools.bash.run({
      command: "halo extension new greeting",
    });
    expect(created.code, `${created.stdout}\n${created.stderr}`).toBe(0);

    await harness.tools.files.write({
      path: ".halo/extensions/greeting/view.tsx",
      content: `
        import { H1, MauiProvider, Padding } from "maui";

        export default function View() {
          return (
            <MauiProvider>
              <Padding xy={8}><H1>Authored through Halo tools</H1></Padding>
            </MauiProvider>
          );
        }
      `,
    });

    const built = await harness.tools.bash.run({
      command: "cd .halo/extensions/greeting && npm run build",
    });
    expect(built.code, `${built.stdout}\n${built.stderr}`).toBe(0);

    const reloaded = await harness.tools.bash.run({
      command: "halo extension reload",
    });
    expect(reloaded.code, `${reloaded.stdout}\n${reloaded.stderr}`).toBe(0);

    await app.page.reload();
    await app.page.getByRole("link", { name: "greeting", exact: true }).click();
    const pane = app.page
      .getByTitle("greeting", { exact: true })
      .contentFrame();
    await expect(
      pane.getByRole("heading", { name: "Authored through Halo tools" }),
    ).toBeVisible();
  },
);
