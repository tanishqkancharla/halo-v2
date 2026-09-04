import { expect } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";
import { m } from "./SessionDescription.js";

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

e2eTest("starts a new session", async ({ harness, renderer }) => {
  await harness.loadSession({
    title: "Existing conversation",
    messages: [
      m.user("Summarize this workspace"),
      m.assistant("Here is the summary."),
    ],
  });

  await renderer.page.getByRole("button", { name: "New session" }).click();

  const newSession = renderer.page.getByRole("main", { name: "New session" });
  await expect(newSession).toBeVisible();
  await expect(newSession.getByLabel("Message")).toBeFocused();
});

e2eTest("shows a connection request", async ({ harness, renderer }) => {
  await harness.loadSession({
    title: "Drive search",
    messages: [
      m.user("Find my planning document"),
      m.connectionRequest({
        client: "google",
        clientOwner: "org",
        owner: "user",
        connectionName: "default",
        integration: "google_drive",
        template: "google",
      }),
    ],
  });

  const card = renderer.page.getByRole("region", {
    name: "Google Drive connection",
  });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Connect" })).toBeVisible();
});

e2eTest(
  "recovers interrupted activity from the durable session log",
  async ({ harness, renderer, server }) => {
    const loaded = await harness.loadSession({
      title: "Interrupted session",
      messages: [
        m.user("Read the project notes"),
        m.assistant("I’ll read the notes."),
      ],
      initialEvents: [
        { type: "run.started", runId: "run-1" },
        {
          type: "tool.started",
          invocation: {
            id: "tool-1",
            runId: "run-1",
            tool: { path: "read", displayName: "Read" },
            arguments: { path: "notes.md" },
          },
        },
      ],
    });

    const pane = renderer.page.getByRole("main", {
      name: "Interrupted session",
    });
    await expect(pane.getByText("Read the project notes")).toBeVisible();
    await expect(pane.getByText("Working", { exact: true })).not.toBeVisible();

    const opened = await server.rpc.sessions.open({
      sessionId: loaded.sessionId,
    });
    expect(
      opened.records.slice(-2).map((record) => record.value),
    ).toMatchObject([
      {
        type: "tool.finished",
        invocationId: "tool-1",
        isError: true,
      },
      {
        type: "run.finished",
        runId: "run-1",
        outcome: "interrupted",
      },
    ]);
  },
);

e2eTest("shows tools used inside exec", async ({ harness, renderer }) => {
  await harness.loadSession({
    title: "Cross-tool lookup",
    messages: [
      m.user("Check my calendar and search the web"),
      m.exec({
        js: "await Promise.all([tools.google_calendar.events.list({}), tools.web.search({ query: 'Halo' })])",
        result: "Done",
        toolLabels: ["Google Calendar", "Web Search"],
      }),
    ],
  });

  await expect(
    renderer.page.getByRole("button", {
      name: "Used Google Calendar, Web Search",
      exact: true,
    }),
  ).toBeVisible();
});
