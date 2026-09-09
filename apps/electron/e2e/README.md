# Electron end-to-end tests

The Electron E2E suite packages Halo once, then launches a fresh app with an isolated workspace and user-data directory for every test.

The `app` fixture opens automatically. Drive the current renderer through `app.page` and the app's public server through `app.server.rpc`. To test a full restart, quit and reopen the same app:

```ts
e2eTest("keeps saved data after reopening", async ({ app }) => {
  // Save through the running app, then restart the whole Electron process.
  await app.quit();
  await app.open();
  await expect(app.page.getByRole("main")).toBeVisible();
});
```

`quit()` closes Electron and its owned server/windows. `open()` launches a fresh process using the same test workspace and user-data directory. Read `app.page` and `app.server` again after reopening; saved pages, locators and RPC clients belong to the previous launch. Harness tool and session helpers resolve the current connection when called. Teardown quits any remaining app, including when the test has already quit it. If setup must happen while Halo is closed, call `app.quit()`, prepare the workspace, then `app.open()`.

The ordinary `e2eTest` fixture owns a scripted OpenAI-compatible HTTP endpoint on a random loopback port. The app fixture passes its URL, model metadata and test API key through `HALO_LLM_CONFIG` on each Electron launch. Main constructs an HTTP-backed `LLMApi` and supplies it to `HaloServer`; Pi's `ModelRuntime` is built on top. The endpoint lives in the harness and stays running across app restarts. Electron has no LLM test event handlers.

Responses follow the timeline of the test:

```ts
e2eTest("answers a message", async ({ app, llm }) => {
  await app.page.getByRole("button", { name: "New session" }).click();
  await app.page.getByLabel("Message", { exact: true }).fill("Hello");
  await app.page.getByRole("button", { name: "Send", exact: true }).click();

  await llm.respond(m.assistant("Hello back."));

  await expect(app.page.getByRole("main")).toContainText("Hello back.");
});
```

`respond()` answers one pending inference request, waiting up to ten seconds if it has not arrived. It releases the scripted response; use UI assertions to wait for Halo to process it. Client disconnection removes pending requests, including when a run stops or Electron quits. Reopening connects to the same endpoint with a fresh app runtime.

Use `m.assistant(...)`, `m.tool.start(...)`, or an array combining text and tool calls. Tool results come from Halo's real tool execution; `m.tool.end(...)` and the seeded-history helpers that include fabricated results are not accepted. `m.error("Model access denied")` returns HTTP 403 with an OpenAI-shaped error body. Successful replies use Chat Completions server-sent events, including tool-call deltas and a finish reason.

Use static replies unless the response needs to depend on the request. A response callback receives the actual OpenAI Chat Completions request and can return a description asynchronously. For history coverage, derive an answer from those messages and assert the visible reply. Message content may be text or content parts; tool results have role `tool`. Avoid request snapshots, call-count assertions, or answers that contain the expected history regardless of what Halo sends.

These tests exercise the real Pi agent loop, tools, and persistence through Pi's real HTTP inference client and a scripted endpoint. They do not verify local Pi authentication, a commercial provider, or a future control-plane transport. The restart scenario in `sessionView.e2e.test.ts` creates its history through actual prompts and tool execution, then proves that restored messages and tool results support the next answer. Separate scenarios cover stopping or quitting during a pending response, and preserving the submitted message while recovering from an inference error.

Extension tests use `extensionE2eTest` and `loadExtension("./fixtures/name")`. The fixture scaffolds an independent package, copies the extension's source files, installs the SDK, typechecks and builds the package, and reloads Halo. Extension source is checked against its installed dependencies, separately from the harness TypeScript project.

`extensionTools.e2e.test.ts` loads a real extension, requests `files.read` through `halo extension tools add`, navigates from the conversation to the extension while its Permissions card is pending, approves access, and clicks Refresh notes to display a workspace file through `context.tools.files.read`. Its source declares the types of the tool it consumes. Separate tests verify revocation in an open pane and approval persistence after restarting Halo. These cover a real workspace tool; they do not establish OAuth or external-service behavior.

Use `harness.tools.files.read({ path })` and `harness.tools.files.write({ path, content })` to author workspace files. These calls reach the running app's real tool runtime through the E2E-only RPC bridge. The runtime checks agent authority, validates tool inputs, resolves workspace paths, and invokes the registered production file tool. The harness has no filesystem implementation or separate runtime.

The bridge returns successful tool data directly (`read` returns `{ path, text }`) and rejects failed calls through RPC. The typed harness surface currently exposes file reads and writes; their input/output types come from the production implementations. The bridge is disabled outside E2E runs.

Scenario actions use product services directly. Harness helpers may organize observations and assertions; fixtures own environmental setup and cleanup. Do not add a parallel files API or a harness server for product artifacts.

`app.openWindow()` opens another real renderer connected to the same server. The Electron fixture owns all windows and closes them when the app quits; the artifact fixture captures their console output and the Playwright trace.

`app.server.rpc.browser` is the same workspace browser API used by `halo browser`. Tests open a browser through that API and drive it through `exec`; Halo owns its lifecycle and closes it when the workspace or app closes. The fixture does not serve assets or fabricate responses.

Run the suite:

```sh
pnpm --filter @halo/desktop test:e2e
```

Show the Electron window while the tests run:

```sh
HALO_E2E_HEADFUL=1 pnpm --filter @halo/desktop test:e2e
```

Open Playwright Inspector and show the Electron window:

```sh
PWDEBUG=1 pnpm --filter @halo/desktop test:e2e
```

Passing tests remove their temporary files. Failed tests, including expected failures, retain their workspace, Electron user data, Halo JSONL logs, renderer console log, and each launch's main-process output, screenshot, and Playwright trace under `tmp/e2e/`. Files use `launch-1`, `launch-2`, etc. so reopening preserves earlier diagnostics. The test output prints the exact retained directory.

Open a retained trace with:

```sh
pnpm --filter @halo/desktop exec playwright show-trace tmp/e2e/<test-directory>/launch-1.trace.zip
```
