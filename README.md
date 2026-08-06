# Halo

Halo is an Electron desktop app with a React renderer and Pi in the main process.

## Structure

- `apps/halo/src`: React UI built with Maui and Vite.
- `apps/halo/electron`: Electron main process, preload bridge, workspace service, and Pi service.
- `packages/halo-web-cli`: Debug UI control through Libretto Browser Tools.
- `packages/ui`: Shared React components.
- `packages/typescript-config`: Shared TypeScript settings.

## Local development

Install dependencies, then start Halo from the repository root:

```sh
pnpm install
pnpm dev
```

On Linux hosts without a real GPU (including cloud agents on Xvfb), force software WebGL:

```sh
export HALO_USE_SWIFTSHADER=1
pnpm --filter @halo/desktop dev
```

Each new app process asks you to choose a workspace folder the first time. Halo saves that choice in app data and reopens it on the next launch. In development, app data lives at `<repo>/.halo/`. Packaged builds use Electron's default userData path.

Halo uses the chosen folder as Pi's working directory and stores Pi data here:

```text
<workspace>/.pi/agent/
├── auth.json
├── models.json
└── sessions/
    └── *.jsonl
```

Pi's file and shell tools run on the host with the same rights as Halo. Halo does not import old AgentOS SQLite workspaces.

Set a model provider key in the shell that starts Halo:

```sh
export ANTHROPIC_API_KEY=your-key
pnpm dev
```

Halo also reads `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `OPENROUTER_API_KEY`. In development, it loads the first `.env` file found in `apps/halo` or the repository root. Keys stay in the main process and do not pass through renderer IPC.

## Debug UI control

Development builds expose Electron's Chrome DevTools Protocol on `127.0.0.1:4445`. The CLI attaches with [Libretto Browser Tools](https://libretto.sh/browser-tools) and leaves Halo running:

```sh
pnpm halo-web status
pnpm halo-web snapshot
pnpm halo-web exec "return await page.locator('body').innerText()"
pnpm halo-web exec "await page.getByRole('button', { name: 'New session' }).click()"
```

Pass `--stdin` for longer scripts. Output uses TOON by default; pass `--json` for JSON. Packaged builds do not expose the debug port.

## Packaging

```sh
pnpm --filter @halo/desktop build
pnpm --filter @halo/desktop make
```

Electron Forge writes packaged apps to `apps/halo/out`.

## Checks

```sh
pnpm run check-affected
```

Tests do not call a paid model.
