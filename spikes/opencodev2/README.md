# OpenCode v2 spike

This is an executable compatibility spike for replacing Pi with OpenCode v2. It is intentionally isolated from the pnpm workspace because OpenCode 2.0.1 needs Effect `4.0.0-rc.112`, while Halo and Executor are pinned to an incompatible Effect beta. OpenCode's published JavaScript also uses runtime features that Halo's Node 22 process cannot parse. Bun runs the package as published.

Run it from this directory:

```sh
bun install
bun run spike
```

The spike uses an in-process scripted model and asserts the product-facing flows rather than calling a paid provider:

- create, list, rename, and restore sessions;
- stream assistant text and durable execution events;
- discover Halo's `AGENTS.md` and `.agents/skills` from the workspace filesystem;
- expose an Executor-backed integration as an OpenCode Code Mode tool, including progress and result events;
- append a synthetic integration notification;
- queue a prompt, change it to steering, and interrupt an active run;
- close and reopen the SDK against the same database and recover the transcript.

## Verdict

OpenCode can replace Pi behind Halo's existing renderer protocol, but 2.0.1 cannot be embedded in the current user-server dependency graph. The viable first migration is an isolated OpenCode service/sidecar plus a Halo session adapter. Moving Halo to a single compatible Effect release and a runtime that supports the published SDK could later remove that process boundary.

Executor should remain during the first migration. The spike proves that its integration calls can sit behind an OpenCode Code Mode tool, so Pi's tool harness is not required. OpenCode can eventually replace Executor's sandbox and generic tool orchestration, but it does not replace Halo's current Google Discovery/OpenAPI ingestion, OAuth/credential ownership, extension tool registration, or permission authority. Remove Executor only after those capabilities move into Halo-owned OpenCode plugins or MCP servers.

| Halo flow                       | Spike result           | Migration work                                                                                                                                 |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Session lifecycle and restart   | Aligned                | Map OpenCode session metadata to Halo summaries and keep a separate OpenCode database.                                                         |
| Streaming and reconnect         | Aligned                | Translate OpenCode event names and message shapes to `SessionWatchItem`. Durable session logs can fill reconnect gaps.                         |
| Prompt and assistant transcript | Aligned                | Adapt OpenCode content parts to Halo's current Pi-shaped `HaloMessage` union, or simplify that shared contract.                                |
| Queue, steer, interrupt         | Aligned                | Preserve Halo's current “prompt while busy means steer” policy in the adapter.                                                                 |
| Instructions and skills         | Aligned                | Point each session at the workspace root. OpenCode discovers `AGENTS.md` and `.agents/skills`.                                                 |
| Code Mode and tool progress     | Aligned                | OpenCode's `execute` replaces Pi's `exec`; translate nested calls into Halo's `ToolExecution`.                                                 |
| Existing Executor integrations  | Aligned through bridge | Register a Code Mode tool that delegates to `ToolRuntime` while integrations migrate.                                                          |
| Extension permissions           | Partial                | Keep `ToolRuntime` as the authority first; later port grants to OpenCode permissions.                                                          |
| Google/OpenAPI integrations     | Gap                    | Build OpenCode plugins or MCP servers for discovery, OAuth, credentials, and dynamic schemas before removing Executor.                         |
| In-process SDK on Halo Node 22  | Blocked                | OpenCode 2.0.1 uses Effect RC and explicit resource management syntax; use an isolated Bun service or change Halo's runtime/dependency layout. |

The package adds roughly 500 installed dependencies in isolation. That footprint, the separate database, and the service lifecycle are costs to include in a production decision.
