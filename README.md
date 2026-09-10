# Halo

Halo is an Electron desktop app with a React renderer and Pi in the main process.

## Structure

- `apps/electron/src/renderer`: React UI built with Maui and Vite.
- `apps/electron/src/main`: Electron main process, preload bridge, workspace service, and Pi service.
- `infra`: Cloudflare infrastructure via [Alchemy](https://alchemy.run/) (`alchemy.run.ts`).
- `packages/halo-cli`: Workspace commands, private browser testing, and debug app control.
- `packages/logger`: Shared structured logger.
- `packages/typescript-config`: Shared TypeScript settings.

## Local development

Install [pnpm 12](https://pnpm.io/installation) with the standalone script, not Corepack. `latest` on npm still points at pnpm 11, so pass the 12 line explicitly:

```sh
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=12.1.0 sh -
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

Halo runs Pi's `AgentHarness` with one `main` lane per conversation. `HaloServer` owns a `DatabaseClient` that stores Pi conversations and Executor application data in one embedded Turso database. The file currently lives in the selected workspace:

```text
<workspace>/
└── .halo/
    └── state.db
```

Halo's `TursoSessionRepo` implements Pi's repository contract, and `TursoStorage` implements its storage contract. Pi's `StorageBackedSession` still owns session and branch behavior. The adapter uses Pi's commit validation and fork helpers and stores data in `halo_sessions`, `halo_session_entries`, `halo_session_values`, `halo_session_lists`, and `halo_session_usage`.

`DatabaseClient` owns one Turso connection and coordinates access to it. It has no Pi or Executor dependencies. `HaloServer` constructs the session repository; `ToolRuntime` builds Executor's Fuma/Drizzle adapter and supplies it to Executor. Both reads and writes wait for admitted transactions, so neither consumer can observe the other's uncommitted changes. Transaction callbacks must use their supplied connection/query and must not wait for tools, network calls, or model inference.

The adapter uses Turso's synchronous compatibility driver and ordinary tables. Turso 0.7.2 does not support recursive CTEs, so branch scans follow indexed parent links without a separate branch-index table. The schema is bundled with Halo; there is no Pi SQLite backend dependency, package patch, or SQL asset-copy step. Existing JSONL and vendor SQLite tables are not imported.

Shutdown stops HTTP admission, closes sessions, drains request handlers, stops tools, closes the repository, then closes the database. Server lifecycle changes are deferred. Executor retains its generated table/index names and independent schema version. Future Halo and extension tables must avoid existing names; use `halo_*` and `ext_<installation>_*`. Extension records, grants, and the credential vault have not moved into this database yet.

The renderer consumes Halo session snapshots and events, adapted from Pi at the server boundary. The [session protocol](packages/shared/README.md) describes stable entries, run state, and first-class nested `exec` activity. It uses Pi's supplied transcript; loading older entries before compaction is deferred. `sessions.watch` sends an initial snapshot followed by ephemeral live events; disconnecting a viewer leaves its running session active. Nested `exec` tool details persist in Pi's tool results and progress checkpoints. Halo does not keep a separate event log or import existing JSONL conversation files.

Pi's file and shell tools run on the host with the same rights as Halo. Halo does not import old AgentOS SQLite workspaces.

Halo also reads provider keys from the first `.env` file found in `apps/electron` or the repository root. Keys stay in the main process and do not pass through renderer IPC.

## Debug UI control

Development builds expose Electron's Chrome DevTools Protocol on `127.0.0.1:4445`. The CLI attaches with [Libretto Browser Tools](https://libretto.sh/browser-tools) and leaves Halo running:

```sh
pnpm halo status
pnpm halo app snapshot
pnpm halo app exec "return await page.locator('body').innerText()"
pnpm halo app exec "await page.getByRole('button', { name: 'New session' }).click()"
```

Use `halo browser open <url>` for an isolated extension preview, followed by `halo browser exec <id>`, `snapshot <id>`, `screenshot <id>`, and `close <id>`. Halo owns these browsers and provisions Chromium on first use.

Pass `--stdin` or `--file checks.js` for longer scripts. Output uses TOON by default; pass `--json` for JSON. Packaged builds do not expose the debug port.

## Cloudflare infrastructure

Cloudflare is the cloud target. Alchemy owns the stack under `infra/`.

| Need                                                         | Cloudflare product                                                | Alchemy resource                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------- |
| Secrets manager                                              | [Secrets Store](https://developers.cloudflare.com/secrets-store/) | `Cloudflare.SecretsStore.Store`     |
| App release artifacts (unused by publish CI; kept for later) | [R2](https://developers.cloudflare.com/r2/) object storage        | `Cloudflare.R2.Bucket` (`Releases`) |

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

`Publish Electron` (`.github/workflows/publish-electron.yml`) builds installers on a version tag and uploads them to a GitHub Release. The tag name must equal `apps/electron/package.json` `version` (for example version `0.1.1` → tag `0.1.1`).

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

Pull requests and pushes to `main` run `pnpm run check-affected` on GitHub Actions (`Check / check-affected`).

```sh
pnpm run check-affected
```

Tests do not call a paid model.
