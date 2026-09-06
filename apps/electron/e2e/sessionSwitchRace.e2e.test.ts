import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";
import {
  loadSessionDescription,
  m,
  sessionDescriptionEvents,
  type SessionDescriptionItem,
} from "./SessionDescription.js";
import type {
  SessionLogEvent,
  ToolIdentity,
} from "@get-halo/shared/sessionLog";

e2eTest(
  "does not bleed events across sessions when switching during a live stream",
  async ({ harness, renderer, server }) => {
    const workspaceRoot = harness.paths.workspace;
    const getToolIdentity = (path: string): Promise<ToolIdentity> =>
      server.rpc.testHarness.getToolIdentity({ path });

    const alpha = await loadSessionDescription({
      description: {
        title: "Alpha race source",
        messages: [m.user("Summarize the notes"), m.assistant("Summarizing.")],
      },
      workspaceRoot,
      getToolIdentity,
    });
    expect(alpha).not.toBeInstanceOf(Error);
    if (alpha instanceof Error) return;

    const beta = await loadSessionDescription({
      description: {
        title: "Bravo race target",
        messages: [m.user("Hello Bravo"), m.assistant("World")],
      },
      workspaceRoot,
      getToolIdentity,
    });
    expect(beta).not.toBeInstanceOf(Error);
    if (beta instanceof Error) return;

    await renderer.page.reload();

    async function appendTo(
      sessionId: string,
      items: SessionDescriptionItem | SessionDescriptionItem[],
    ) {
      const opened = await server.rpc.sessions.open({ sessionId });
      const events = await sessionDescriptionEvents({
        items: Array.isArray(items) ? items : [items],
        history: opened.records.map((r) => r.value),
        getToolIdentity,
      });
      if (events instanceof Error) throw events;
      // SAFETY: sessionDescriptionEvents returns SessionLogEvent[] on success;
      // the instanceof check above narrows away the Error branch.
      await server.rpc.testHarness.appendSessionEvents({
        sessionId,
        events: events as SessionLogEvent[],
      });
    }

    async function switchTo(title: string) {
      await renderer.page
        .getByRole("link", { name: title, exact: true })
        .click();
      await renderer.page
        .getByRole("main", { name: title, exact: true })
        .waitFor();
    }

    const bravoPane = renderer.page.getByRole("main", {
      name: "Bravo race target",
    });
    await expect(bravoPane).toBeVisible();
    await expect(bravoPane.getByText("World")).toBeVisible({
      timeout: 30_000,
    });

    await switchTo("Alpha race source");
    const alphaPane = renderer.page.getByRole("main", {
      name: "Alpha race source",
    });
    await expect(alphaPane.getByText("Summarizing.")).toBeVisible({
      timeout: 30_000,
    });

    await appendTo(alpha.sessionId, [
      m.run.start({ id: "alpha-run" }),
      m.tool.start("read", {
        id: "alpha-read",
        arguments: { path: "alpha-notes.md" },
      }),
    ]);
    await expect(
      alphaPane.getByRole("status", { name: "Working" }),
    ).toBeVisible({ timeout: 30_000 });

    await appendTo(alpha.sessionId, [
      m.tool.start("read", {
        id: "alpha-leak",
        arguments: { path: "alpha-leak.md" },
      }),
    ]);

    await switchTo("Bravo race target");
    await expect(bravoPane.getByText("World")).toBeVisible();
    await expect(
      bravoPane.getByText("Alpha notes", { exact: true }),
    ).toHaveCount(0);
    await expect(bravoPane.getByText(/alpha-leak/i)).toHaveCount(0);
    await expect(
      bravoPane.getByRole("status", { name: "Working" }),
    ).toHaveCount(0);
    await expect(bravoPane.getByText("Summarizing.")).toHaveCount(0);
    await expect(bravoPane.getByText("Summarize the notes")).toHaveCount(0);
  },
);
