# Halo

Halo is a Tauri 2 desktop app with a React frontend and a Rust backend. The first local AgentOS phase lives in `apps/halo`.

## Structure

- `apps/halo/src`: React developer UI built with Maui and Vite.
- `apps/halo/src-tauri`: Tauri host and Rust AgentOS service.
- `packages/ui`: shared React components.
- `packages/typescript-config`: shared TypeScript settings.

The Rust service starts one native AgentOS sidecar and one VM for the local workspace. It stores the VM filesystem and session history in the app-data `agentos.sqlite` file. The sidecar runs Pi from its packed AgentOS package. Halo does not start a Node backend process.

Pinned AgentOS versions:

- `agentos-client = 0.2.15`
- `agentos-vm-config = 0.2.15`
- `@rivet-dev/agentos-sidecar = 0.2.15`
- `@agentos-software/pi = 0.2.7`

## Local development

Install dependencies, then start the app from the repository root:

```sh
pnpm install
pnpm dev
```

The normal development command starts Vite, Tauri, the native sidecar, and the AgentOS VM.

File tools work without a model key. To use Pi, set one supported key in the shell that starts Halo:

```sh
export ANTHROPIC_API_KEY=your-key
pnpm dev
```

In development builds, the Rust host also loads the first `.env` file it finds in `apps/halo`, the repository root, or `apps/halo/src-tauri`. Existing shell variables take priority. These files are ignored by Git.

Halo also detects `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `OPENROUTER_API_KEY`. The key stays out of the frontend and logs. AgentOS may store session environment values as plain text in `agentos.sqlite`; Halo limits the app-data directory to the current user on Unix systems.

## Workspace storage

Each workspace has one AgentOS VM and one SQLite database. The database is the complete portable workspace. Copying it to another machine must restore the workspace files, Halo workspace state, and AgentOS sessions.

Halo does not query or change AgentOS SQLite tables. It reads and writes all workspace state through AgentOS VM file APIs. This keeps the same state visible to Halo and to agents running in the VM.

Halo asks for the username before it starts the workspace. The username must be one safe path segment. Halo then uses this layout:

```text
/halo/<username>/
├── files/
├── workspace.json
├── agents/
├── tools/
└── vault.enc
```

The user's home directory inside the VM is `/halo/<username>/files/`. Halo stores its workspace state beside `files/`; it does not create a hidden `.halo/` directory.

Device settings do not belong to a workspace. Keep settings that apply to the local Halo install outside the workspace database.

## Checks

```sh
pnpm --filter @halo/desktop typecheck
pnpm --filter @halo/desktop lint
pnpm --filter @halo/desktop format:check
cargo test --manifest-path apps/halo/src-tauri/Cargo.toml
```

Tests do not call a paid model.
