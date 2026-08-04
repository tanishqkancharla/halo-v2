---
name: halo-web
description: Drive and test the webview in a running Halo Tauri debug app with the project-local halo-web CLI and WebdriverIO. Use when an agent needs to inspect Halo's rendered UI, click controls, enter text, read state or errors, take screenshots, or verify an end-to-end UI change against the live desktop app.
---

# Halo Web

Use `pnpm halo-web` from the repository root to control the webview in the running Halo debug app. The CLI attaches to the app; it does not build, launch, restart, or stop Halo.

## Test workflow

1. Check the existing app before starting a process:

   ```sh
   pnpm halo-web status
   ```

2. If the server is not ready and the task calls for live app testing, start `pnpm dev` in a long-running terminal. Wait for the app to open, then run `status` again. Only debug builds expose WebDriver, at `127.0.0.1:4445`.
3. Inspect the current page before acting:

   ```sh
   pnpm halo-web exec 'return await browser.$("body").getText()'
   ```

4. Act through stable, user-visible selectors. Prefer `data-testid`, accessible names, labels, and roles over CSS classes or DOM position.
5. Wait for the state caused by the action and return the value that proves the requested behavior. Do not treat a successful click as proof that the UI changed.

Keep a short inspect-act-verify sequence in one `exec` call when the steps belong to one test. Each call opens a fresh WebDriver session, closes that session afterward, and leaves Halo running.

## Run scripts

Pass a short async function body as one shell argument. The `browser` WebdriverIO object is already in scope:

```sh
pnpm halo-web exec 'return await browser.getTitle()'
pnpm halo-web exec 'await browser.$("button").click()'
```

Use `--stdin` for scripts that need several statements or awkward shell quoting:

```sh
printf '%s\n' \
  'const input = await browser.$("textarea[aria-label=Message]");' \
  'await input.setValue("Hello");' \
  'await browser.$("button[type=submit]").click();' \
  'const transcript = await browser.$("[role=log]");' \
  'await transcript.waitForDisplayed();' \
  'return await transcript.getText();' \
  | pnpm halo-web exec --stdin
```

The source is a function body, not a full function declaration. Use `await` directly. Add `return` when the caller needs a result; a script with no return produces `null`.

## Inspect and verify

Use focused queries first, then broaden to the page body when the current structure is unknown:

```sh
pnpm halo-web exec 'return await browser.$("[role=alert]").getText()'
pnpm halo-web exec 'return await browser.$("[data-testid=sessions-shell]").isDisplayed()'
pnpm halo-web exec 'const buttons = await browser.$$("button"); return await Promise.all(buttons.map(async (element) => await element.getText()))'
```

Wait on the expected element or text when an action triggers async work:

```js
const alert = await browser.$("[role=alert]");
await alert.waitForDisplayed();
return await alert.getText();
```

For visual evidence, save a screenshot to a clear path and report that path:

```sh
pnpm halo-web exec 'await browser.saveScreenshot("/tmp/halo.png")'
```

## CLI details

- Use `pnpm halo-web --llms-full` to read the current command manifest.
- Use `pnpm halo-web exec --schema` to inspect the script input schema.
- Output uses TOON by default. Add Incur's `--json` flag when another command must parse the result.
- A failed `status` means no compatible debug app is listening. Do not hide it with a fallback port or another browser tool.
- Keep app lifecycle ownership separate: `halo-web` must not start, restart, or stop Halo.
