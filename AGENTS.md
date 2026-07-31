# Halo

Halo is an open-source self-modifiable desktop app built using Tauri, AgentOS and Turso. It's currently a work-in-progress.

## Commands

- `pnpm run check-affected` - Lint, typecheck, build, format-check, and test affected packages

## Code Style

- Prefer explicit, straightforward code. Don't use fallbacks. Avoid patterns like `||` and `??`.
- Don't support backwards-compatibility unless explicitly asked to.
- Simplify as you go. When you touch code, remove nearby indirection, compatibility paths, defensive branches, unused helpers, or duplicated state that no longer serve the current design. Simplification is iterative: after removing one unnecessary condition or abstraction, look again for variables, branches, helpers, or comments that only existed to support it.
- Don't over-worry. Avoid `try`/`catch`, guard clauses, `if`/`throw`, retries, fallback values, and defensive checks unless the user asked for them or you know a specific error can happen and this layer is responsible for handling it. When handling a known external quirk, add a short comment that names the source of the behavior.
- Local code should have local worries. Do not compensate in one place for sub-optimal behavior in another place when the link is not direct. Step back, identify the ownership boundary, and consider a cleaner design instead.
- Prefer explicit types; avoid `any`.
- TypeScript uses strict mode with `noUncheckedIndexedAccess` enabled.
- ESM imports use `.js` extensions even for TypeScript files.
- Workspace packages use the `@repo/*` naming convention.
- Use `vitest` for tests: `describe`, `test`, `expect`. Don't use `beforeAll` or `afterAll`; use Vitest fixtures instead.
- Generally, you should avoid adding comments and instead aim to make code readable. The only exception is when there is external context that is not easily traced back (e.g. external dependency behavior, or explicit business logic decisions).

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

- Agents and humans should always have access to the same state. Which is why all Halo configuration is just stored in the AgentOS filesystem and Halo shouldn't directly manipulate the underlying Sqlite database.
