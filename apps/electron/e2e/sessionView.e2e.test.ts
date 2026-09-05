import { expect, type Locator } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";
import { m } from "./SessionDescription.js";

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
        m.run.start({ id: "run-1" }),
        m.tool.start("read", {
          id: "tool-1",
          arguments: { path: "notes.md" },
        }),
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
  const descriptionJs =
    "return await tools.describe.tool({ path: 'google_calendar.events.list' })";
  const searchJs = "return await tools.search({ query: 'web search' })";
  const lookupJs =
    "await Promise.all([tools.google_calendar.events.list({}), tools.web.search({ query: 'Halo' })])";
  await harness.loadSession({
    title: "Cross-tool lookup",
    messages: [
      m.user("Check my calendar and search the web"),
      m.exec({
        js: descriptionJs,
        tools: [{ path: "describe.tool" }],
        result: "Calendar tool schema",
      }),
      m.exec({
        js: searchJs,
        tools: [{ path: "search" }],
        result: "Web search tools found",
      }),
      m.exec({
        js: lookupJs,
        tools: [
          { path: "google_calendar.events.list" },
          { path: "web.search" },
        ],
        result: "Done",
      }),
    ],
  });

  const summary = renderer.page.getByRole("button", {
    name: "Searched tools and used Google Calendar, Web Search",
    exact: true,
  });
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(
    renderer.page.getByText("Searched tools", { exact: true }),
  ).toHaveCount(2);
  await expect(
    renderer.page.getByText("Used Google Calendar", { exact: true }),
  ).toHaveCount(1);
  await expect(
    renderer.page.getByText("Used Web Search", { exact: true }),
  ).toHaveCount(1);
  await expect(renderer.page.getByText("Exec", { exact: true })).toHaveCount(0);
  for (const tool of [
    {
      path: "describe.tool",
      label: "Searched tools",
      js: descriptionJs,
      result: "Calendar tool schema",
    },
    {
      path: "search",
      label: "Searched tools",
      js: searchJs,
      result: "Web search tools found",
    },
    {
      path: "google_calendar.events.list",
      label: "Used Google Calendar",
      js: lookupJs,
      result: "Done",
    },
    {
      path: "web.search",
      label: "Used Web Search",
      js: lookupJs,
      result: "Done",
    },
  ]) {
    const call = renderer.page.getByRole("button", {
      name: `${tool.label} (${tool.path})`,
      exact: true,
    });
    await call.click();
    const details = renderer.page.getByRole("region", {
      name: tool.path,
      exact: true,
    });
    await expect(details.getByRole("code")).toHaveText([tool.js, tool.result]);
    await call.click();
  }
});

e2eTest(
  "wraps exec code and results in individual tool details",
  async ({ harness, renderer }, testInfo) => {
    const query = "calendar scheduling ".repeat(25);
    const js = `return await tools.search({ query: '${query}' });`;
    const result = `https://example.com/${"calendar".repeat(80)}`;
    await harness.loadSession({
      title: "Wrapped tool details",
      messages: [
        m.exec({
          js,
          tools: [{ path: "search", arguments: { query } }],
          result,
        }),
      ],
    });
    await renderer.page
      .getByRole("button", { name: "Searched tools", exact: true })
      .click();
    await renderer.page
      .getByRole("button", { name: "Searched tools (search)", exact: true })
      .click();
    const details = renderer.page.getByRole("region", {
      name: "search",
      exact: true,
    });
    const code = details.getByRole("code");
    await expect(code).toHaveText([js, result]);
    await expect
      .poll(() =>
        details.evaluate((element) =>
          Array.from(element.querySelectorAll("pre")).every(
            (block) => block.scrollWidth <= block.clientWidth,
          ),
        ),
      )
      .toBe(true);
    for (const block of await code.all()) {
      await expect
        .poll(() =>
          block.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return new Set(
              Array.from(range.getClientRects(), (rect) => rect.top),
            ).size;
          }),
        )
        .toBeGreaterThan(1);
    }
    await testInfo.attach("wrapped exec details", {
      body: await details.screenshot(),
      contentType: "image/png",
    });
  },
);

e2eTest(
  "streams tool activity labels as session events arrive",
  async ({ harness, renderer }, testInfo) => {
    const session = await harness.loadSession({
      title: "Live cross-tool lookup",
    });
    const pane = renderer.page.getByRole("main", {
      name: "Live cross-tool lookup",
    });

    await session.append(m.run.start());
    await expect(pane.getByText("Working", { exact: true })).toBeVisible();
    await expectThinkingVisible(pane.getByRole("status", { name: "Working" }));

    await session.append(
      m.exec.start({
        js: "await Promise.all([tools.google_calendar.events.list({}), tools.web.search({ query: 'Halo' })])",
      }),
    );
    const execSummary = pane.getByRole("button", {
      name: "Using tools",
      exact: true,
    });
    await expect(execSummary).toBeVisible();
    await expectThinkingVisible(
      execSummary.getByRole("status", { name: "Working" }),
    );
    await expect(
      execSummary.getByRole("img", { name: "Expand tool activity" }),
    ).toBeHidden();

    await session.append(m.exec.tool.start("search"));
    const discoverySummary = pane.getByRole("button", {
      name: "Searching tools",
      exact: true,
    });
    await expect(discoverySummary).toBeVisible();
    await expectThinkingVisible(
      discoverySummary.getByRole("status", { name: "Working" }),
    );
    await expect(
      discoverySummary.getByRole("img", { name: "Expand tool activity" }),
    ).toBeHidden();
    await testInfo.attach("live tool activity", {
      body: await pane.screenshot(),
      contentType: "image/png",
    });

    await discoverySummary.hover();
    await expect(
      discoverySummary.getByRole("status", { name: "Working" }),
    ).toBeHidden();
    await expect(
      discoverySummary.getByRole("img", { name: "Expand tool activity" }),
    ).toBeVisible();
    await discoverySummary.click();
    await expect(
      pane.getByText("Searching tools", { exact: true }),
    ).toHaveCount(2);
    await pane.getByLabel("Message", { exact: true }).hover();
    await expectThinkingVisible(
      discoverySummary.getByRole("status", { name: "Working" }),
    );
    await expect(
      discoverySummary.getByRole("img", { name: "Expand tool activity" }),
    ).toBeHidden();

    await session.append(m.exec.tool.end());
    await expect(discoverySummary).toBeVisible();
    await expect(
      pane.getByText("Searching tools", { exact: true }),
    ).toHaveCount(1);
    await expect(pane.getByText("Searched tools", { exact: true })).toHaveCount(
      1,
    );

    await session.append(m.exec.tool.start("google_calendar.events.list"));
    await expect(
      pane.getByRole("button", { name: "Using Google Calendar", exact: true }),
    ).toBeVisible();
    await expect(pane.getByText("Searched tools", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      pane.getByText("Using Google Calendar", { exact: true }),
    ).toHaveCount(2);

    await session.append([m.exec.tool.end(), m.exec.tool.start("web.search")]);
    await expect(
      pane.getByText("Used Google Calendar", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pane.getByRole("button", { name: "Using Web Search", exact: true }),
    ).toBeVisible();
    await expect(
      pane.getByText("Using Web Search", { exact: true }),
    ).toHaveCount(2);

    await session.append([m.exec.tool.end(), m.exec.end(), m.run.end()]);
    const completedSummary = pane.getByRole("button", {
      name: "Searched tools and used Google Calendar, Web Search",
      exact: true,
    });
    await expect(completedSummary).toBeVisible();
    await expect(
      completedSummary.getByRole("status", { name: "Working" }),
    ).toHaveCount(0);
    await expect(
      completedSummary.getByRole("img", { name: "Expand tool activity" }),
    ).toBeVisible();
    await expect(pane.getByText("Searched tools", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      pane.getByText("Used Google Calendar", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pane.getByText("Used Web Search", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pane.getByText("Using Web Search", { exact: true }),
    ).not.toBeVisible();
  },
);

const expansionScenarios: {
  name: string;
  path: string;
  nested: boolean;
  args: Record<string, string>;
  active: string;
  completed: string;
  aggregate: string;
  result: string;
}[] = [
  {
    name: "nested integration",
    path: "google_calendar.events.list",
    nested: true,
    args: { calendarId: "primary" },
    active: "Using Google Calendar",
    completed: "Used Google Calendar",
    aggregate: "Used Google Calendar",
    result: "Team planning at 10 AM",
  },
  {
    name: "tool discovery",
    path: "search",
    nested: true,
    args: { query: "calendar" },
    active: "Searching tools",
    completed: "Searched tools",
    aggregate: "Searched tools",
    result: "Found google_calendar.events.list",
  },
  {
    name: "direct file",
    path: "read",
    nested: false,
    args: { path: "notes.md" },
    active: "Reading notes.md",
    completed: "Read notes.md",
    aggregate: "Read 1 file",
    result: "Project notes from the workspace",
  },
];

for (const scenario of expansionScenarios) {
  e2eTest(
    `expands ${scenario.name} tool calls while streaming and after reload`,
    async ({ harness, renderer }, testInfo) => {
      const session = await harness.loadSession({ title: "Expandable tools" });
      const pane = renderer.page.getByRole("main", {
        name: "Expandable tools",
      });
      const lifecycle = scenario.nested ? m.exec.tool : m.tool;
      const js = `const result = await tools.${scenario.path}(${JSON.stringify(scenario.args)}); return result;`;
      const result = scenario.nested
        ? `Exec returned: ${scenario.result}`
        : scenario.result;
      await session.append(m.run.start());
      if (scenario.nested) {
        await session.append(m.exec.start({ js }));
      }
      await session.append(
        lifecycle.start(scenario.path, { arguments: scenario.args }),
      );

      const summary = pane.getByRole("button", {
        name: scenario.active,
        exact: true,
      });
      await summary.click();
      const call = pane.getByRole("button", {
        name: `${scenario.active} (${scenario.path})`,
        exact: true,
      });
      await expect(call).toHaveAttribute("aria-expanded", "false");
      await expect(call.locator("svg")).toHaveCount(0);
      await call.click();
      await expect(call).toHaveAttribute("aria-expanded", "true");
      const details = pane.getByRole("region", {
        name: scenario.path,
        exact: true,
      });
      await expect(details).toBeVisible();
      await expect(details.getByRole("code")).toHaveText(
        scenario.nested ? js : JSON.stringify(scenario.args, undefined, 2),
      );
      await expectThinkingVisible(
        summary.getByRole("status", { name: "Working" }),
      );

      await session.append(lifecycle.end({ result: scenario.result }));
      if (scenario.nested) {
        await expect(
          details.getByText(scenario.result, { exact: true }),
        ).toHaveCount(0);
        await session.append(m.exec.end({ result }));
      }
      await expect(details.getByText(result, { exact: true })).toBeVisible();
      const completedCall = pane.getByRole("button", {
        name: `${scenario.completed} (${scenario.path})`,
        exact: true,
      });
      await expect(completedCall).toHaveAttribute("aria-expanded", "true");
      await testInfo.attach("expanded tool details", {
        body: await pane.screenshot(),
        contentType: "image/png",
      });
      await session.append(m.run.end());

      await completedCall.click();
      await expect(details).toBeHidden();
      await completedCall.click();
      await expect(details.getByText(result, { exact: true })).toBeVisible();

      await renderer.page.reload();
      await pane
        .getByRole("button", { name: scenario.aggregate, exact: true })
        .click();
      await completedCall.click();
      await expect(details.getByText(result, { exact: true })).toBeVisible();
    },
  );
}

e2eTest(
  "matches tool endings by path, latest start, and explicit ID",
  async ({ harness, renderer }) => {
    const session = await harness.loadSession({ title: "Parallel tools" });
    const pane = renderer.page.getByRole("main", { name: "Parallel tools" });
    await session.append([
      m.run.start({ id: "lookup" }),
      m.exec.start({
        js: "return await tools.google_calendar.events.list({})",
        id: "calendar",
      }),
      m.exec.tool.start("google_calendar.events.list", { id: "events" }),
      m.exec.start({ js: "return await tools.web.search({ query: 'Halo' })" }),
      m.exec.tool.start("web.search"),
      m.exec.tool.start("search"),
    ]);
    await pane
      .getByRole("button", { name: "Searching tools", exact: true })
      .click();

    await session.append(m.exec.tool.end({ path: "web.search" }));
    await expect(
      pane.getByText("Used Web Search", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pane.getByText("Searching tools", { exact: true }),
    ).toHaveCount(2);
    await expect(
      pane.getByText("Using Google Calendar", { exact: true }),
    ).toHaveCount(1);

    await session.append([m.exec.tool.end(), m.exec.end()]);
    await expect(pane.getByText("Searched tools", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      pane.getByText("Using Google Calendar", { exact: true }),
    ).toHaveCount(2);

    await session.append(m.exec.tool.start("web.search"));
    await session.append(m.exec.tool.end({ id: "events" }));
    await expect(
      pane.getByText("Used Google Calendar", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pane.getByText("Using Web Search", { exact: true }),
    ).toHaveCount(2);

    await expect(
      session.append(m.exec.tool.end({ id: "events" })),
    ).rejects.toThrow("No matching unfinished start");
    await session.append([
      m.exec.tool.end(),
      m.exec.end({ id: "calendar" }),
      m.run.end({ id: "lookup" }),
    ]);
    await expect(
      pane.getByRole("button", {
        name: "Searched tools and used Google Calendar, Web Search",
        exact: true,
      }),
    ).toBeVisible();

    await session.append([
      m.run.start(),
      m.tool.start("read", { arguments: { path: "notes.md" } }),
      m.tool.start("read", { arguments: { path: "README.md" } }),
    ]);
    await pane
      .getByRole("button", { name: "Reading README.md", exact: true })
      .click();
    await session.append(m.tool.end());
    await expect(pane.getByText("Read README.md", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      pane.getByText("Reading notes.md", { exact: true }),
    ).toHaveCount(2);
    await session.append([
      m.tool.end(),
      m.read({ path: "notes.md", result: "Notes again" }),
      m.run.end(),
    ]);
    await expect(
      pane.getByRole("button", {
        name: "Searched tools, read 2 files, and used Google Calendar, Web Search",
        exact: true,
      }),
    ).toBeVisible();
  },
);

e2eTest(
  "shows a generic label for unlabeled exec work",
  async ({ harness, renderer }) => {
    await harness.loadSession({
      title: "Generic tool work",
      messages: [
        m.user("Do the work"),
        m.exec({ js: "return 'done'", result: "Done" }),
      ],
    });

    const summary = renderer.page.getByRole("button", {
      name: "Used tools",
      exact: true,
    });
    await summary.click();
    await renderer.page
      .getByRole("button", { name: "Used tools (exec)", exact: true })
      .click();
    const details = renderer.page.getByRole("region", {
      name: "exec",
      exact: true,
    });
    await expect(details.getByRole("code").first()).toHaveText("return 'done'");
    await expect(details.getByText("Done", { exact: true })).toBeVisible();
  },
);

async function expectThinkingVisible(indicator: Locator) {
  await expect(indicator).toBeVisible();
  // The status container can be visible even when its animated dots have no painted area.
  await expect
    .poll(() =>
      indicator.evaluate((element) =>
        Array.from(element.children).some((dot) => {
          const bounds = dot.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            Number(getComputedStyle(dot).opacity) > 0
          );
        }),
      ),
    )
    .toBe(true);
}

e2eTest(
  "deduplicates completed file activity by normalized path",
  async ({ harness, renderer }) => {
    await harness.loadSession({
      title: "Read project files",
      messages: [
        m.user("Read the project files"),
        m.read({ path: "./notes.md", result: "Notes" }),
        m.read({
          path: `${harness.paths.workspace}/notes.md`,
          result: "Notes again",
        }),
        m.read({ path: "README.md", result: "Readme" }),
      ],
    });

    await expect(
      renderer.page.getByRole("button", {
        name: "Read 2 files",
        exact: true,
      }),
    ).toBeVisible();
  },
);
