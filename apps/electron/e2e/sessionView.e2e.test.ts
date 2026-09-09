import { expect, type Locator } from "@playwright/test";
import { e2eTest } from "./e2eTest.js";
import { m } from "@get-halo/shared/testing";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

e2eTest("starts a new session", async ({ harness, app }) => {
  await harness.loadSession({
    title: "Existing conversation",
    messages: [
      m.user("Summarize this workspace"),
      m.assistant("Here is the summary."),
    ],
  });

  await app.page.getByRole("button", { name: "New session" }).click();

  const newSession = app.page.getByRole("main", { name: "New session" });
  await expect(newSession).toBeVisible();
  await expect(newSession.getByLabel("Message", { exact: true })).toBeFocused();
});

e2eTest(
  "keeps the selected session and draft pages after reload",
  async ({ harness, app }) => {
    for (const title of ["Earlier conversation", "Latest conversation"]) {
      await harness.loadSession({
        title,
        messages: [m.user(title), m.assistant("Saved reply")],
      });
    }
    await app.page
      .getByRole("link", { name: "Earlier conversation", exact: true })
      .click();
    await app.page.reload();
    await expect(
      app.page.getByRole("main", { name: "Earlier conversation" }),
    ).toBeVisible();

    await app.page.getByRole("button", { name: "New session" }).click();
    const draft = app.page.getByRole("main", { name: "New session" });
    await expect(draft).toBeVisible();
    await app.page.reload();
    await expect(draft).toBeVisible();
  },
);

e2eTest(
  "continues with saved messages and tool results after quitting Halo",
  async ({ app, harness, llm }) => {
    await harness.tools.files.write({
      path: "notes.md",
      content: "The project mascot is a blue bicycle.",
    });
    await app.page.getByRole("button", { name: "New session" }).click();
    await app.page
      .getByLabel("Message", { exact: true })
      .fill("Read the project notes");
    await app.page.getByRole("button", { name: "Send", exact: true }).click();
    await llm.respond([
      m.assistant("I will read the notes."),
      m.tool.start("read", {
        id: "read-notes",
        arguments: { path: "notes.md" },
      }),
    ]);
    await llm.respond(m.assistant("The notes are saved."));
    await expect(app.page.getByRole("main")).toContainText(
      "The notes are saved.",
    );
    await expect(
      app.page.getByRole("button", { name: "Stop", exact: true }),
    ).not.toBeVisible();

    await app.quit();
    await app.open();

    const pane = app.page.getByRole("main");
    const transcript = pane.getByRole("log", { name: "Session transcript" });
    await expect(
      transcript.getByText("Read the project notes", { exact: true }),
    ).toBeVisible();
    await expect(
      transcript.getByText("The notes are saved.", {
        exact: true,
      }),
    ).toBeVisible();

    await pane
      .getByLabel("Message", { exact: true })
      .fill("Continue the conversation");
    await pane.getByRole("button", { name: "Send", exact: true }).click();
    await llm.respond(({ messages }) =>
      m.assistant(
        [
          `Earlier prompts: ${messages
            .filter((message) => message.role === "user")
            .map((message) => messageText(message))
            .join(" → ")}`,
          `Earlier answers: ${messages
            .filter((message) => message.role === "assistant")
            .map((message) => messageText(message))
            .join(" → ")}`,
          `Earlier tool results: ${messages
            .filter((message) => message.role === "tool")
            .map((message) => messageText(message))
            .join("\n")}`,
        ].join("\n\n"),
      ),
    );
    await expect(
      transcript.getByText(
        "Earlier prompts: Read the project notes → Continue the conversation",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      transcript.getByText(
        "Earlier answers: I will read the notes. → The notes are saved.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      transcript.getByText(
        "Earlier tool results: The project mascot is a blue bicycle.",
        { exact: true },
      ),
    ).toBeVisible();
  },
);

e2eTest(
  "answers a new message after stopping a pending model response",
  async ({ app, llm }) => {
    await app.page.getByRole("button", { name: "New session" }).click();
    await app.page
      .getByLabel("Message", { exact: true })
      .fill("Start a long answer");
    await app.page.getByRole("button", { name: "Send", exact: true }).click();

    await app.page.getByRole("button", { name: "Stop", exact: true }).click();
    await app.page
      .getByLabel("Message", { exact: true })
      .fill("Answer this instead");
    await app.page.getByRole("button", { name: "Send", exact: true }).click();
    await llm.respond(m.assistant("Here is the new answer."));

    await expect(app.page.getByRole("main")).toContainText(
      "Here is the new answer.",
    );
  },
);

e2eTest(
  "answers after quitting Halo during a pending response",
  async ({ app, llm }) => {
    await app.page.getByRole("button", { name: "New session" }).click();
    await app.page
      .getByLabel("Message", { exact: true })
      .fill("Start an answer");
    await app.page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      app.page.getByRole("article", { name: "You message" }),
    ).toContainText("Start an answer");

    await app.quit();
    await app.open();

    await app.page
      .getByLabel("Message", { exact: true })
      .fill("Answer after reopening");
    await app.page.getByRole("button", { name: "Send", exact: true }).click();
    await llm.respond(m.assistant("Here is the answer after reopening."));

    await expect(app.page.getByRole("main")).toContainText(
      "Here is the answer after reopening.",
    );
  },
);

e2eTest(
  "titles a session immediately and keeps its first message when inference is denied",
  async ({ app, llm }) => {
    await app.page.getByRole("button", { name: "New session" }).click();
    const pane = app.page.getByRole("main");
    const observed = await app.page.evaluateHandle(() => {
      const titles: string[] = [];
      const observer = new MutationObserver(() => {
        const title = document
          .querySelector("main > header")
          ?.getAttribute("aria-label");
        if (title !== undefined && title !== null) titles.push(title);
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      return { titles, observer };
    });
    await pane
      .getByLabel("Message", { exact: true })
      .fill("Keep my original question");
    await pane.getByRole("button", { name: "Send", exact: true }).click();
    await expect(app.page.locator("main > header")).toHaveText(
      "Keep my original question",
    );
    await llm.respond(m.error("Model access denied"));

    await expect(pane.getByRole("alert")).toContainText("Model access denied");
    await expect(
      pane.getByRole("article", { name: "You message" }),
    ).toContainText("Keep my original question");

    await pane.getByLabel("Message", { exact: true }).fill("Try again");
    await pane.getByRole("button", { name: "Send", exact: true }).click();
    await llm.respond(m.assistant("Ready to continue."));

    await expect(
      pane.getByRole("log", { name: "Session transcript" }),
    ).toContainText("Ready to continue.");
    await expect(pane.getByRole("alert")).not.toBeVisible();
    await expect(app.page.locator("main > header")).toHaveText(
      "Keep my original question",
    );
    const [session] = await app.server.rpc.sessions.list();
    expect(session).toBeDefined();
    const observedTitles = await observed.evaluate(({ titles, observer }) => {
      observer.disconnect();
      return titles;
    });
    await observed.dispose();
    expect(observedTitles).toContain("Keep my original question");
    expect(observedTitles).not.toContain(session!.sessionId);
  },
);

e2eTest("shows a connection request", async ({ harness, app }) => {
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

  const card = app.page.getByRole("region", {
    name: "Google Drive connection",
  });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Connect" })).toBeVisible();
});

e2eTest(
  "recovers interrupted activity from the durable session log",
  async ({ harness, app }) => {
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

    const pane = app.page.getByRole("main", {
      name: "Interrupted session",
    });
    await expect(pane.getByText("Read the project notes")).toBeVisible();
    await expect(pane.getByText("Working", { exact: true })).not.toBeVisible();

    const opened = await app.server.rpc.sessions.open({
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

e2eTest("shows tools used inside exec", async ({ harness, app }) => {
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

  const summary = app.page.getByRole("button", {
    name: "Searched tools and used Google Calendar, Web Search",
    exact: true,
  });
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(
    app.page.getByText("Searched tools", { exact: true }),
  ).toHaveCount(2);
  await expect(
    app.page.getByText("Used Google Calendar", { exact: true }),
  ).toHaveCount(1);
  await expect(
    app.page.getByText("Used Web Search", { exact: true }),
  ).toHaveCount(1);
  await expect(app.page.getByText("Exec", { exact: true })).toHaveCount(0);
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
    const call = app.page.getByRole("button", {
      name: `${tool.label} (${tool.path})`,
      exact: true,
    });
    await call.click();
    const details = app.page.getByRole("region", {
      name: tool.path,
      exact: true,
    });
    await expect(details.getByRole("code")).toHaveText([tool.js, tool.result]);
    await call.click();
  }
});

e2eTest(
  "wraps exec code and results in individual tool details",
  async ({ harness, app }) => {
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
    await app.page
      .getByRole("button", { name: "Searched tools", exact: true })
      .click();
    await app.page
      .getByRole("button", { name: "Searched tools (search)", exact: true })
      .click();
    const details = app.page.getByRole("region", {
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
  },
);

e2eTest(
  "streams tool activity labels as session events arrive",
  async ({ harness, app }) => {
    const session = await harness.loadSession({
      title: "Live cross-tool lookup",
    });
    const pane = app.page.getByRole("main", {
      name: "Live cross-tool lookup",
    });

    await session.append(m.run.start());
    await expect(pane.getByText("Working", { exact: true })).toBeVisible();
    await expectThinkingVisible(pane.getByRole("status", { name: "Working" }));

    await session.append(
      m.exec.start({
        id: "lookup",
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

    await session.append(
      m.exec.tool.start("search", { id: "discovery", parentId: "lookup" }),
    );
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

    await session.append(m.exec.tool.end({ id: "discovery" }));
    await expect(discoverySummary).toBeVisible();
    await expect(
      pane.getByText("Searching tools", { exact: true }),
    ).toHaveCount(1);
    await expect(pane.getByText("Searched tools", { exact: true })).toHaveCount(
      1,
    );

    await session.append(
      m.exec.tool.start("google_calendar.events.list", {
        id: "calendar",
        parentId: "lookup",
      }),
    );
    await expect(
      pane.getByRole("button", { name: "Using Google Calendar", exact: true }),
    ).toBeVisible();
    await expect(pane.getByText("Searched tools", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      pane.getByText("Using Google Calendar", { exact: true }),
    ).toHaveCount(2);

    await session.append([
      m.exec.tool.end({ id: "calendar" }),
      m.exec.tool.start("web.search", { id: "web", parentId: "lookup" }),
    ]);
    await expect(
      pane.getByText("Used Google Calendar", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pane.getByRole("button", { name: "Using Web Search", exact: true }),
    ).toBeVisible();
    await expect(
      pane.getByText("Using Web Search", { exact: true }),
    ).toHaveCount(2);

    await session.append([
      m.exec.tool.end({ id: "web" }),
      m.exec.end({ id: "lookup" }),
      m.run.end(),
    ]);
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
    async ({ harness, app }) => {
      const session = await harness.loadSession({ title: "Expandable tools" });
      const pane = app.page.getByRole("main", {
        name: "Expandable tools",
      });
      const lifecycle = scenario.nested ? m.exec.tool : m.tool;
      const js = `const result = await tools.${scenario.path}(${JSON.stringify(scenario.args)}); return result;`;
      const result = scenario.nested
        ? `Exec returned: ${scenario.result}`
        : scenario.result;
      await session.append(m.run.start());
      if (scenario.nested) {
        await session.append(m.exec.start({ id: "exec", js }));
      }
      await session.append(
        lifecycle.start(scenario.path, {
          id: "tool",
          parentId: scenario.nested ? "exec" : undefined,
          arguments: scenario.args,
        }),
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

      await session.append(
        lifecycle.end({ id: "tool", result: scenario.result }),
      );
      if (scenario.nested) {
        await expect(
          details.getByText(scenario.result, { exact: true }),
        ).toHaveCount(0);
        await session.append(m.exec.end({ id: "exec", result }));
      }
      await expect(details.getByText(result, { exact: true })).toBeVisible();
      const completedCall = pane.getByRole("button", {
        name: `${scenario.completed} (${scenario.path})`,
        exact: true,
      });
      await expect(completedCall).toHaveAttribute("aria-expanded", "true");
      await session.append(m.run.end());

      await completedCall.click();
      await expect(details).toBeHidden();
      await completedCall.click();
      await expect(details.getByText(result, { exact: true })).toBeVisible();

      await app.page.reload();
      await pane
        .getByRole("button", { name: scenario.aggregate, exact: true })
        .click();
      await completedCall.click();
      await expect(details.getByText(result, { exact: true })).toBeVisible();
    },
  );
}

e2eTest(
  "keeps parallel tool activity visible when another tool finishes",
  async ({ harness, app }) => {
    const session = await harness.loadSession({ title: "Parallel tools" });
    const pane = app.page.getByRole("main", { name: "Parallel tools" });
    await session.append([
      m.run.start({ id: "lookup" }),
      m.exec.start({
        js: "return await tools.google_calendar.events.list({})",
        id: "calendar",
      }),
      m.exec.tool.start("google_calendar.events.list", {
        id: "events",
        parentId: "calendar",
      }),
      m.exec.start({
        id: "web",
        js: "return await tools.web.search({ query: 'Halo' })",
      }),
      m.exec.tool.start("web.search", { id: "search", parentId: "web" }),
    ]);
    await pane
      .getByRole("button", { name: "Using Web Search", exact: true })
      .click();

    await session.append([
      m.exec.tool.end({ id: "events" }),
      m.exec.end({ id: "calendar" }),
    ]);
    await expect(
      pane.getByRole("button", {
        name: "Used Google Calendar (google_calendar.events.list)",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      pane.getByRole("button", {
        name: "Using Web Search (web.search)",
        exact: true,
      }),
    ).toBeVisible();
    await session.append([
      m.exec.tool.end({ id: "search" }),
      m.exec.end({ id: "web" }),
      m.run.end({ id: "lookup" }),
    ]);
    await expect(
      pane.getByRole("button", {
        name: "Used Google Calendar, Web Search",
        exact: true,
      }),
    ).toBeVisible();
  },
);

e2eTest(
  "shows a generic label for unlabeled exec work",
  async ({ harness, app }) => {
    await harness.loadSession({
      title: "Generic tool work",
      messages: [
        m.user("Do the work"),
        m.exec({ js: "return 'done'", result: "Done" }),
      ],
    });

    const summary = app.page.getByRole("button", {
      name: "Used tools",
      exact: true,
    });
    await summary.click();
    await app.page
      .getByRole("button", { name: "Used tools (exec)", exact: true })
      .click();
    const details = app.page.getByRole("region", {
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
  async ({ harness, app }) => {
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
      app.page.getByRole("button", {
        name: "Read 2 files",
        exact: true,
      }),
    ).toBeVisible();
  },
);

function messageText(message: ChatCompletionMessageParam): string {
  if (message.content === null || message.content === undefined) return "";
  if (!Array.isArray(message.content)) return message.content;
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
