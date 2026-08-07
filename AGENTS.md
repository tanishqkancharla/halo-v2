# Halo

Halo is an open-source self-modifiable desktop app built with Electron and Pi. It's currently a work-in-progress.

## Commands

- `pnpm run check-affected` - Lint, typecheck, format-check, and test affected packages. Run this after edits before you treat the work as done.

## Code Style

- Prefer explicit, straightforward code. Don't use fallbacks. Avoid patterns like `||` and `??`.
- Don't support backwards-compatibility unless explicitly asked to.
- Simplify as you go. When you touch code, remove nearby indirection, compatibility paths, defensive branches, unused helpers, or duplicated state that no longer serve the current design. Simplification is iterative: after removing one unnecessary condition or abstraction, look again for variables, branches, helpers, or comments that only existed to support it.
- Don't over-worry. Avoid guard clauses, `if`/`throw`, retries, fallback values, and defensive checks unless the user asked for them or you know a specific error can happen and this layer is responsible for handling it. When handling a known external quirk, add a short comment that names the source of the behavior.
- Local code should have local worries. Do not compensate in one place for sub-optimal behavior in another place when the link is not direct. Step back, identify the ownership boundary, and consider a cleaner design instead.
- Prefer explicit types; avoid `any`.
- TypeScript uses strict mode with `noUncheckedIndexedAccess` enabled.
- ESM imports use `.js` extensions even for TypeScript files.
- Workspace packages use the `@repo/*` naming convention.
- Use `vitest` for tests: `describe`, `test`, `expect`. Don't use `beforeAll` or `afterAll`; use Vitest fixtures instead.
- Generally, you should avoid adding comments and instead aim to make code readable. The only exception is when there is external context that is not easily traced back (e.g. external dependency behavior, or explicit business logic decisions).

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

Headless hosts (Xvfb/VNC) need `HALO_USE_SWIFTSHADER=1`, which the `halo-dev` terminal exports. Without it the renderer cannot start WebGL.

To chat with a model, set a provider key as an environment secret: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`). The dev terminal inherits it and Pi picks that provider's default model with no extra step. Halo builds, tests, and launches without a key; you only need one to send a prompt.

First launch shows a "Choose workspace" screen that opens a native folder dialog, which `halo-web` cannot click. To reach the main UI in a headless run, pick the workspace before launching by writing the preference file, then start the app so `restore()` opens it:

```sh
mkdir -p /home/ubuntu/halo-workspace /workspace/.halo
echo '{"workspaceRoot":"/home/ubuntu/halo-workspace"}' > /workspace/.halo/workspace.json
```

`.halo/` holds dev userData and is gitignored.
