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

Halo installs Maui from GitHub Packages as `maui@npm:@tanishqkancharla/maui`. The repository `.npmrc` points the `@tanishqkancharla` scope at `https://npm.pkg.github.com`. pnpm 11 will not expand `${NODE_AUTH_TOKEN}` from a committed project `.npmrc`, so put the token in your user npmrc (never commit it):

```sh
export NODE_AUTH_TOKEN="$(gh auth token)"
pnpm config set "//npm.pkg.github.com/:_authToken" '${NODE_AUTH_TOKEN}' --location user
pnpm install
pnpm dev
```

`NODE_AUTH_TOKEN` must be a GitHub token with `read:packages`. `gh auth token` works if that account can read `@tanishqkancharla/maui`. A classic PAT or fine-grained token with Packages read is the usual local choice.

Forks and other GitHub Actions repositories do not inherit package access. Grant `tanishqkancharla/halo-v2` read access on the package (GitHub → the `@tanishqkancharla/maui` package → Package settings → Manage Actions access), then CI can use `GITHUB_TOKEN` with `packages: read`. Until that grant exists, the `Release` workflow uses the repo secret `NODE_AUTH_TOKEN` (a token with `read:packages`). A fork needs its own token and package grant.

Installs must not compile Maui. The published tarball already contains `dist/`.

Then start Halo from the repository root:

```sh
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
| App release artifacts (unused by publish CI; kept for later) | [R2](https://developers.cloudflare.com/r2/) object storage | `Cloudflare.R2.Bucket` (`Releases`) |

```sh
pnpm infra:login
pnpm infra:plan
pnpm infra:deploy
pnpm infra:dev
```

First login stores Cloudflare credentials in `~/.alchemy/profiles.json`. CI uses `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN` instead. Electron releases publish to GitHub Releases (see [Publishing](#publishing)).

## Packaging

```sh
pnpm --filter @halo/desktop build
pnpm --filter @halo/desktop make
```

Electron Forge writes packaged apps to `apps/electron/out`.

## Publishing

`Publish Electron` (`.github/workflows/publish-electron.yml`) builds installers on a version tag and uploads them to a GitHub Release. The tag name must equal `apps/electron/package.json` `version` (for example version `0.1.1` → tag `0.1.1`). The workflow creates the release first, then marks it latest only after Linux, macOS, Windows, and plugin-sdk all succeed.

Packaged macOS and Windows builds check for updates through [update.electronjs.org](https://update.electronjs.org), which reads those GitHub Releases. macOS builds are signed and notarized in CI.

### One-time GitHub setup

Create a GitHub Environment named `Release` (name is case-sensitive) and add:

**Variables**

- `APPLE_TEAM_ID` — Apple Team ID (for example `S2ZR72G4R4`)

**Secrets**

- `APPLE_CERTIFICATE_BASE64` — base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD` — password for that `.p12`
- `APPLE_API_KEY_BASE64` — base64-encoded App Store Connect API `.p8` key
- `APPLE_API_KEY_ID` — App Store Connect API key id
- `APPLE_API_ISSUER` — App Store Connect issuer UUID

### Run a publish

1. Set `version` in `apps/electron/package.json`.
2. Commit that change on `main`.
3. Create and push a matching tag:

```sh
git tag 0.1.1
git push origin 0.1.1
```

Artifacts appear on the GitHub Release for that tag.

## Checks

```sh
pnpm run check-affected
```

Tests do not call a paid model.
