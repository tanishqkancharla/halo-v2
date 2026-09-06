# Electron end-to-end tests

The Electron E2E suite packages Halo once, then launches a fresh app with an isolated workspace and user-data directory for every test.

Use the Halo client directly: `server.rpc.plugins.create({ id, storage: true })` and `server.rpc.plugins.build()`. The server fixture prepares the local SDK and workspace packages for E2E dependency installation, so tests exercise the current build without relying on a published SDK version.

Use `harness.pluginFiles(plugin)` to edit a created plugin. The server API tests expose the same helper through `server.harness.pluginFiles(plugin)`.

```ts
const plugin = await server.rpc.plugins.create({ id: "notes" });
const files = harness.pluginFiles(plugin);
await files.updateManifest({ capabilities: ["files.read"] });
await files.write({
  "server.ts": `
    import { pluginOs } from "@get-halo/plugin-sdk/server";
    export default { ping: pluginOs.handler(() => "pong") };
  `,
});
await server.rpc.plugins.build();
```

File names are relative to the plugin directory. `updateManifest` patches fields in `package.json`'s `halo` object and preserves the package dependencies and other manifest fields. It accepts invalid values for validation tests. Neither helper builds or reloads the plugin; those actions stay explicit in the test. The existing fixture owns cleanup.

`harness.openWindow()` opens another real renderer connected to the same server. The Electron fixture owns all windows and closes them at teardown; the artifact fixture captures their console output and the Playwright trace.

`plugins.e2e.test.ts` uses the scaffold's Add controls in two windows, exercising `usePluginTransaction` and `usePluginQuery` without calling sync routes. It verifies that opening another client preserves the original view's subscription and that the original view receives changes without reloading.

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
