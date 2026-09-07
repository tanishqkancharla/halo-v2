# Electron end-to-end tests

The Electron E2E suite packages Halo once, then launches a fresh app with an isolated workspace and user-data directory for every test.

Use the Halo client directly: `server.rpc.plugins.create({ id, storage: true })` and `server.rpc.plugins.build()`. The server fixture prepares the local SDK and workspace packages for E2E dependency installation, so tests exercise the current build without relying on a published SDK version.

Use `harness.tools.files.read({ path })` and `harness.tools.files.write({ path, content })` to author plugin files. These calls reach the running app's real tool runtime through the E2E-only RPC bridge. The runtime checks agent authority, validates tool inputs, resolves workspace paths, and invokes the registered production file tool. The harness has no filesystem implementation or separate runtime.

```ts
const plugin = await server.rpc.plugins.create({ id: "notes" });
await harness.tools.files.write({
  path: path.join(plugin.directory, "server.ts"),
  content: `
    import { pluginOs } from "@get-halo/plugin-sdk/server";
    export default { ping: pluginOs.handler(() => "pong") };
  `,
});
await server.rpc.plugins.build();
```

The bridge returns successful tool data directly (`read` returns `{ path, text }`) and rejects failed calls through RPC. The typed harness surface currently exposes file reads and writes; their input/output types come from the production implementations. The bridge is disabled outside E2E runs. Calls act with agent authority; they do not impersonate a plugin or bypass the additional grants that plugins require.

Write the desired file contents directly; tests do not need to generate edit deltas. When changing the manifest, read the scaffolded package, preserve its dependency fields, and write the full updated JSON.

Scenario actions use product services directly. Harness helpers may organize observations and assertions; fixtures own environmental setup and cleanup. Do not add a parallel plugin-files API or a harness server for product artifacts.

`harness.openWindow()` opens another real renderer connected to the same server. The Electron fixture owns all windows and closes them at teardown; the artifact fixture captures their console output and the Playwright trace.

`plugins.e2e.test.ts` uses the scaffold's Add controls in two windows, exercising `usePluginTransaction` and `usePluginQuery` without calling sync routes. It verifies that opening another client preserves the original view's subscription and that the original view receives changes without reloading.

The standalone pane test is a test-first specification spanning pane builds and browser opening. It creates a plugin, writes its source/CSS/manifest through `harness.tools.files`, builds through RPC, discovers the pane's server-generated `url` through `plugins.list`, and opens it with `agentBrowser.open(url)`. Mounting the plugin makes its backend and frontend available through the workspace host. Opening a URL does not create or remount the plugin, and there is no `plugins.openPane` RPC.

`agentBrowser` is a temporary stand-in for the agent's eventual VM browser API. It delegates navigation to a real Playwright browser page in a fresh test context, separate from Electron. Playwright owns its browser lifecycle, screenshot, and trace. The fixture does not serve assets, fabricate responses, or initialize plugin code; Halo must serve the discovered URL and authenticate the browser connection.

Discovery does not expose pane URLs yet. One temporary `@ts-expect-error` marks that missing field, and the test currently fails at the URL assertion. Remove the directive when adding the discovery field. Once the document is available, the test checks interactive React/Maui rendering, SDK schema execution, and imported CSS. Storage synchronization remains separate coverage.

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

Passing tests remove their temporary files. Failed tests, including expected failures, retain their workspace, Electron user data, Halo JSONL logs, main-process output, renderer console log, screenshot, and Playwright trace under `tmp/e2e/`. The test output prints the exact retained directory.

Open a retained trace with:

```sh
pnpm --filter @halo/desktop exec playwright show-trace tmp/e2e/<test-directory>/trace.zip
```
