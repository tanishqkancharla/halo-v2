# Electron end-to-end tests

The Electron E2E suite packages Halo once, then launches a fresh app with an isolated workspace and user-data directory for every test.

Extension tests use `extensionE2eTest` and `loadExtension("./fixtures/name")`. The fixture scaffolds an independent package, copies the extension's source files, installs the SDK, typechecks and builds the package, and reloads Halo. Extension source is checked against its installed dependencies, separately from the harness TypeScript project.

`extensionTools.e2e.test.ts` loads a real extension, requests `files.read` through `halo extension tools add`, navigates from the conversation to the extension while its Permissions card is pending, approves access, and clicks Refresh notes to display a workspace file through `context.tools.files.read`. Its source declares the types of the tool it consumes. Separate tests verify revocation in an open pane and approval persistence after restarting Halo. These cover a real workspace tool; they do not establish OAuth or external-service behavior.

Use `harness.tools.files.read({ path })` and `harness.tools.files.write({ path, content })` to author workspace files. These calls reach the running app's real tool runtime through the E2E-only RPC bridge. The runtime checks agent authority, validates tool inputs, resolves workspace paths, and invokes the registered production file tool. The harness has no filesystem implementation or separate runtime.

The bridge returns successful tool data directly (`read` returns `{ path, text }`) and rejects failed calls through RPC. The typed harness surface currently exposes file reads and writes; their input/output types come from the production implementations. The bridge is disabled outside E2E runs.

Scenario actions use product services directly. Harness helpers may organize observations and assertions; fixtures own environmental setup and cleanup. Do not add a parallel files API or a harness server for product artifacts.

`harness.openWindow()` opens another real renderer connected to the same server. The Electron fixture owns all windows and closes them at teardown; the artifact fixture captures their console output and the Playwright trace.

`server.rpc.browser` is the same workspace browser API used by `halo browser`. Tests open a browser through that API and drive it through `exec`; Halo owns its lifecycle and closes it when the workspace or app closes. The fixture does not serve assets or fabricate responses.

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
