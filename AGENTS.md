# Halo

Halo is an open-source self-modifiable desktop app built with Electron and Pi. It's currently a work-in-progress.

## Commands

- `pnpm run check-affected` - Lint, typecheck, format-check, and test affected packages. Run this after edits before you treat the work as done.
- `pnpm spec <file>` / `pnpm walkthrough <file>` / `pnpm exec tkstack <file>` - Serve a spec or code walkthrough as a local tkstack page.

## Releasing

Bump `apps/electron/package.json` `version`, commit, then create and push a git tag with that exact same version string (no `v` prefix). Example: version `0.1.1` → tag `0.1.1`. That tag push runs `Publish Electron`, which builds installers and uploads them to a non-draft GitHub Release. The release is marked latest only after Linux, macOS, Windows, and plugin-sdk succeed. Packaged apps check for updates via `update.electronjs.org`.

## Maui (GitHub Packages)

Halo depends on `maui@npm:@tanishqkancharla/maui` from `https://npm.pkg.github.com`, not a Git URL. `.npmrc` scopes `@tanishqkancharla` to that registry. Do not commit a token. pnpm 11 ignores auth tokens in the project `.npmrc`, so set the token in the user npmrc:

```sh
export NODE_AUTH_TOKEN="$(gh auth token)"  # or a PAT with read:packages
pnpm config set "//npm.pkg.github.com/:_authToken" '${NODE_AUTH_TOKEN}' --location user
pnpm install
```

CI: `packages: read` plus `actions/setup-node` `registry-url` / `scope` for GitHub Packages. A workflow step writes the token with `pnpm config set` from `GITHUB_TOKEN`. That works only after the Halo repo is granted read access on the Maui package. Forks need their own token and grant.

## Code Style

- Prefer explicit, straightforward code. Don't use fallbacks. Avoid patterns like `||` and `??`.
- Use `undefined` for missing values, not `null` (`unicorn/no-null`). This differs from errore.org's `| null` default. Keep `null` only where an external API uses it (JSON `null`, DOM, Electron, Cap'n Web). Compare those values with `=== null`; the lint rule allows that.
- Don't support backwards-compatibility unless explicitly asked to.
- Simplify as you go. When you touch code, remove nearby indirection, compatibility paths, defensive branches, unused helpers, or duplicated state that no longer serve the current design. Simplification is iterative: after removing one unnecessary condition or abstraction, look again for variables, branches, helpers, or comments that only existed to support it.
- Don't over-worry. Avoid guard clauses, `if`/`throw`, retries, fallback values, and defensive checks unless the user asked for them or you know a specific error can happen and this layer is responsible for handling it. When handling a known external quirk, add a short comment that names the source of the behavior.
- Local code should have local worries. Do not compensate in one place for sub-optimal behavior in another place when the link is not direct. Step back, identify the ownership boundary, and consider a cleaner design instead.
- Prefer explicit types; avoid `any`.
- Prefer TypeScript `private` / `private readonly` over `#` private fields, matching the rest of the codebase.
- TypeScript uses strict mode with `noUncheckedIndexedAccess` enabled.
- ESM imports use `.js` extensions even for TypeScript files.
- Workspace packages use the `@repo/*` naming convention.
- File names: no hyphens. Name the file after the main abstraction it implements, in ClassNameCase (e.g. `MessagePortMainTransport.ts`). For a small bundle of related exports with no single primary type, use a lowercase single name (e.g. `rpc.ts`, `channels.ts`).
- Use `vitest` for tests: `describe`, `test`, `expect`. Don't use `beforeAll` or `afterAll`; use Vitest fixtures instead.
- Generally, you should avoid adding comments and instead aim to make code readable. The only exception is when there is external context that is not easily traced back (e.g. external dependency behavior, or explicit business logic decisions).

## Working Style

- Garden as you go. When the current work exposes small, clear friction—such as incorrect guidance, stale docs, misleading comments, dead code, or a confusing local API—fix it in the same change and verify the fix. If the issue is too large, risky, or separate to finish well in the current session, do not derail the main task; note it and discuss or scope it as follow-up work.
- If straightforward code seems to need surprising guards, wrappers, assertions, or other ceremony, stop and research how the dependency's own code and reference projects handle the same case before keeping that shape.
- When working on issues that seem like they would be common (e.g. issues hooking up popular libraries to each other), do research into the Github issues of those repos or research code of projects that use the same libraries. Here's some reference projects you can look at:
  - Craft Agents: https://github.com/craft-ai-agents/craft-agents-oss. Uses Electron, Pi (`@mariozechner/pi-coding-agent`), Vite, and esbuild.
  - bb: https://github.com/get-bb/bb. Electron + Vite + React agent IDE with a plugin system (`package.json` + nested `halo`).
  - Prime Agent: https://github.com/PrimeIntellect-ai/prime-agent

## Error handling (errore.org)

This codebase uses the [errore.org](https://errore.org) convention. Always read the `errore` skill (`.agents/skills/errore/SKILL.md`) before editing TypeScript that handles failures. Always `import * as errore from 'errore'`.

- If the failure is expected and comes from app code, return an `Error` (prefer `errore.createTaggedError`) instead of throwing. Callers check with `instanceof Error` and early-return.
- If the failure is expected and comes from external library code (or other throwing APIs such as `JSON.parse`, `fetch`, file I/O), convert at that boundary with `errore.try` (sync) or `.catch((e) => new MyError({ cause: e }))` (async). Prefer `.catch()` over `errore.tryAsync`.
- Do not catch unexpected exceptions. When one shows up, pick a strategy for that case.
- Replace `try`/`finally` resource cleanup with `await using` + `errore.AsyncDisposableStack` (or `using` + `errore.DisposableStack`) when cleanup is needed.
- At legacy boundaries that still require throws (for example Electron IPC rejection), convert a returned error back to a throw only at that edge: `if (result instanceof Error) throw result`.

## Writing Rules

Writing rules, from Orwell, 1946. These govern prose: docs, PR text, messages. Never touch code or technical terms; swap in everyday words only where precision survives.

1. Never use a metaphor, simile or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Review every prose output against these rules before delivering.

## Design Guidance

- Agents and humans should always have access to the same state. Store Halo and Pi state in the chosen workspace filesystem.

## Cursor Cloud specific instructions

The one service is the Halo Electron app. Start it from the repo root with `pnpm --filter @halo/desktop dev`; the `halo-dev` terminal in `.cursor/environment.json` already runs this. It serves the Vite renderer and opens the Electron window, and dev builds expose Chrome DevTools Protocol on `127.0.0.1:4445`. Drive and inspect the renderer with `pnpm halo-web` (see the halo-web skill). After edits, run `pnpm run check-affected` (see Commands).

When adding or changing any UI, always record a short demo video of the change and attach it to the PR (and show it in the walkthrough). Use screen recording against the running Halo app; do not skip this for “small” UI tweaks.

Dev Agentation notes sync through the `agentation-mcp` terminal (`127.0.0.1:4747`). Query pending notes with `GET http://127.0.0.1:4747/pending`. Cursor loads the same server from `.cursor/mcp.json`.

Cloudflare infrastructure lives in `infra/` (Alchemy). Use `pnpm infra:login`, `pnpm infra:plan`, and `pnpm infra:deploy`.

Headless hosts (Xvfb/VNC) need `HALO_USE_SWIFTSHADER=1`, which the `halo-dev` terminal exports. Without it the renderer cannot start WebGL.

To chat with a model, set a provider key as an environment secret: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`). The dev terminal inherits it and Pi picks that provider's default model with no extra step. Halo builds, tests, and launches without a key; you only need one to send a prompt.

First launch shows a "Choose workspace" screen that opens a native folder dialog, which `halo-web` cannot click. To reach the main UI in a headless run, pick the workspace before launching by writing the preference file, then start the app so `restore()` opens it:

```sh
mkdir -p /home/ubuntu/halo-workspace /workspace/.halo
echo '{"workspaceRoot":"/home/ubuntu/halo-workspace"}' > /workspace/.halo/workspace.json
```

`.halo/` holds dev userData and is gitignored. Choosing a workspace seeds `{workspace}/.pi/agent/skills/halo-plugin/SKILL.md` and `{workspace}/.pi/agent/skills/maui/SKILL.md` when those files are missing. Reload (View → Reload, or Cmd-R / Ctrl-R) to pick up plugin edits.
