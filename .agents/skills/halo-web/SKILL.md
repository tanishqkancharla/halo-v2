---
name: halo-web
description: Drive and test the renderer in a running Halo Electron debug app with the project-local halo-web CLI and Libretto Browser Tools. Use when an agent needs to inspect Halo's UI, click controls, enter text, read state or errors, take screenshots, or verify an end-to-end UI change.
---

# Halo Web

Use `pnpm halo-web` from the repository root. The CLI attaches to a running debug app. It does not build, launch, restart, or stop Halo.

## Test workflow

1. Check the app:

   ```sh
   pnpm halo-web status
   ```

2. If the app is not ready and the task calls for live testing, start `pnpm dev` in a long-running terminal. Development builds expose Electron's Chrome DevTools Protocol on `127.0.0.1:4445`.
3. Inspect the accessibility tree:

   ```sh
   pnpm halo-web snapshot
   ```

4. Act through stable, visible selectors. Prefer test IDs, accessible names, labels, and roles over CSS classes or DOM position.
5. Wait for the state caused by the action and return the value that proves the behavior.

Each command connects with Libretto Browser Tools, detaches afterward, and leaves Halo running.

## Run code

Pass an async function body with Playwright's `page` in scope:

```sh
pnpm halo-web exec 'return await page.title()'
pnpm halo-web exec "await page.getByRole('button', { name: 'New session' }).click()"
```

Use `--stdin` for longer code:

```sh
printf '%s\n' \
  "const editor = page.getByLabel('Message');" \
  "await editor.fill('Hello');" \
  "await page.getByRole('button', { name: 'Send' }).click();" \
  "await page.getByRole('log').waitFor();" \
  "return await page.getByRole('log').innerText();" \
  | pnpm halo-web exec --stdin
```

Use `await` directly. Add `return` when you need a result. `browser_exec` also returns console output, errors, and the accessibility-tree change caused by the code.

## Inspect and verify

```sh
pnpm halo-web snapshot
pnpm halo-web exec "return await page.getByRole('alert').innerText()"
pnpm halo-web exec "return await page.getByTestId('sessions-shell').isVisible()"
pnpm halo-web exec "return await page.getByRole('button').allTextContents()"
```

For visual evidence, use the snapshot screenshot option:

```sh
pnpm halo-web snapshot --screenshot --json
```

## CLI details

- Use `pnpm halo-web --llms-full` to read the command manifest.
- Use `pnpm halo-web exec --schema` to inspect script input.
- Output uses TOON by default. Add `--json` when another command must parse it.
- A failed `status` means no compatible debug app is listening. Do not hide it with another port or browser tool.
- Keep app lifecycle ownership separate from the CLI.
