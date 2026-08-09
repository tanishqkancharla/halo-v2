# Halo

Halo is an Electron desktop app with a React renderer and Pi in the main process.

## Structure

- `apps/electron/src/renderer`: React UI built with Maui and Vite.
- `apps/electron/src/main`: Electron main process, preload bridge, workspace service, and Pi service.
- `infra`: Cloudflare infrastructure via [Alchemy](https://alchemy.run/) (`alchemy.run.ts`).
- `packages/halo-web-cli`: Debug UI control through Libretto Browser Tools.
- `packages/logger`: Shared structured logger.
- `packages/typescript-config`: Shared TypeScript settings.

## Local development

Install dependencies, then start Halo from the repository root:

```sh
pnpm install
pnpm dev
```

On Linux hosts without a real GPU (including Cursor cloud agents on Xvfb), set `HALO_USE_SWIFTSHADER=1` before starting Halo. The Cursor environment terminal always exports it.

```sh
export HALO_USE_SWIFTSHADER=1
pnpm --filter @halo/desktop dev
```

Set a model provider key for the same process:

```sh
export OPENAI_API_KEY=your-key
# or ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY
```

In Cursor cloud agents, add the key as an environment secret named `OPENAI_API_KEY` (or another provider key above) in the Secrets panel. The dev terminal inherits it, so Pi picks it up with no extra step. Halo builds, tests, and launches without a key; you only need one to chat with a model.

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

Halo also reads provider keys from the first `.env` file found in `apps/electron` or the repository root. Keys stay in the main process and do not pass through renderer IPC.

## Debug UI control

Development builds expose Electron's Chrome DevTools Protocol on `127.0.0.1:4445`. The CLI attaches with [Libretto Browser Tools](https://libretto.sh/browser-tools) and leaves Halo running:

```sh
pnpm halo-web status
pnpm halo-web snapshot
pnpm halo-web exec "return await page.locator('body').innerText()"
pnpm halo-web exec "await page.getByRole('button', { name: 'New session' }).click()"
```

Pass `--stdin` for longer scripts. Output uses TOON by default; pass `--json` for JSON. Packaged builds do not expose the debug port.

## Cloudflare infrastructure

Cloudflare is the cloud target. Alchemy owns the stack under `infra/`.

| Need | Cloudflare product | Alchemy resource |
| --- | --- | --- |
| Secrets manager | [Secrets Store](https://developers.cloudflare.com/secrets-store/) | `Cloudflare.SecretsStore.Store` |
| App release artifacts | [R2](https://developers.cloudflare.com/r2/) object storage | `Cloudflare.R2.Bucket` (`Releases`) |

```sh
pnpm infra:login
pnpm infra:plan
pnpm infra:deploy
pnpm infra:dev
```

First login stores Cloudflare credentials in `~/.alchemy/profiles.json`. CI uses `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN` instead. Electron publish to R2 uses the `Release` GitHub Environment (see [Publishing](#publishing)).

## Packaging

```sh
pnpm --filter @halo/desktop build
pnpm --filter @halo/desktop make
```

Electron Forge writes packaged apps to `apps/electron/out`.

## Publishing

`Publish Electron` (`.github/workflows/publish-electron.yml`) builds installers and uploads them to the Alchemy `Releases` R2 bucket. Only `tanishqkancharla` can run it on `tanishqkancharla/halo-v2`.

The deployed bucket name is `halo-releases-dev-ubuntu-auuzjrvkmjn3x2oy` (ENAM, Standard).

### One-time GitHub setup

1. Confirm infra is deployed (`pnpm infra:deploy` if needed).
2. In the Cloudflare dashboard, create an [R2 API token](https://developers.cloudflare.com/r2/api/tokens/) with Object Read & Write on that bucket.
3. Create a GitHub Environment named `Release` on this repo (name is case-sensitive).
4. Add environment **variables**:
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id
   - `HALO_RELEASES_BUCKET` — `halo-releases-dev-ubuntu-auuzjrvkmjn3x2oy`
5. Add environment **secrets**:
   - `R2_ACCESS_KEY_ID` — R2 access key id
   - `R2_SECRET_ACCESS_KEY` — R2 secret access key

### Run a publish

Use **Actions → Publish Electron → Run workflow**. Artifacts land at:

```text
s3://halo-releases-dev-ubuntu-auuzjrvkmjn3x2oy/<version>/<platform>/<arch>/<file>
```

Local publish (same env vars as above, with R2 keys mapped to `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`):

```sh
pnpm --filter @halo/desktop publish
```

## Checks

```sh
pnpm run check-affected
```

Tests do not call a paid model.
