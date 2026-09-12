# OpenCode v2 spike

This is an executable compatibility spike for replacing Pi with OpenCode v2. It exercises the intended network topology: an OpenCode 2.0.2 server runs under Bun, and `@opencode/client` runs in a separate Node 22 process that represents the Halo device client.

The package is intentionally isolated from the pnpm workspace. The server and embedded SDK need Effect `4.0.0-rc.112`, while Halo is pinned to an incompatible Effect beta. The published server also contains extensionless and directory ESM imports that stock Node 22 cannot load. These are server packaging constraints, not client constraints.

Run it from this directory:

```sh
bun install
bun run spike
```

The spike uses an in-process scripted model and asserts the product-facing flows rather than calling a paid provider. Every flow below crosses the real OpenCode HTTP API from the Node device process:

- create, list, rename, and restore sessions;
- stream assistant text and durable execution events;
- discover Halo's `AGENTS.md` and `.agents/skills` from the workspace filesystem;
- expose an Executor-backed integration as an OpenCode Code Mode tool, including progress and result events;
- append a synthetic integration notification;
- queue a prompt, change it to steering, and interrupt an active run;
- close and reopen the server against the same database and recover the transcript.

`bun run embedded` retains the smaller in-memory SDK proof for comparison. The default `bun run spike` command is the network proof.

## Verdict

OpenCode can replace Pi behind Halo's existing renderer protocol. The device should use `@opencode/client`, which the spike proves works on Node 22. The control plane should run the OpenCode server in an isolated Bun container or process. It should not embed the full SDK in the existing Node 22 control-plane process until OpenCode's published Node package and Halo's Effect graph are compatible.

The important remaining architecture boundary is the workspace. OpenCode's server owns tool execution, while Halo's workspace files and shell currently live in `apps/workspace-server`. A control-plane OpenCode server must either connect to that host through an OpenCode workspace driver or delegate filesystem, shell, browser, extension, and integration tools through a Halo plugin. The network spike uses a local directory; it does not prove that remote workspace bridge.

Executor should remain during the first migration. The spike proves that its integration calls can sit behind an OpenCode Code Mode tool, so Pi's tool harness is not required. OpenCode can eventually replace Executor's sandbox and generic tool orchestration, but it does not replace Halo's current Google Discovery/OpenAPI ingestion, OAuth/credential ownership, extension tool registration, or permission authority. Remove Executor only after those capabilities move into Halo-owned OpenCode plugins or MCP servers.

| Halo flow                        | Spike result           | Migration work                                                                                                                                      |
| -------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node device client over HTTP     | Aligned                | Use `@opencode/client`, add Halo authentication, and reconnect its event stream after network changes.                                              |
| Session lifecycle and restart    | Aligned                | Map OpenCode session metadata to Halo summaries and keep a separate OpenCode database.                                                              |
| Streaming and reconnect          | Aligned                | Translate OpenCode event names and message shapes to `SessionWatchItem`. Durable session logs can fill reconnect gaps.                              |
| Prompt and assistant transcript  | Aligned                | Adapt OpenCode content parts to Halo's current Pi-shaped `HaloMessage` union, or simplify that shared contract.                                     |
| Queue, steer, interrupt          | Aligned                | Preserve Halo's current “prompt while busy means steer” policy in the adapter.                                                                      |
| Instructions and skills          | Aligned                | The server must expose the workspace root or a remote workspace representation.                                                                     |
| Code Mode and tool progress      | Aligned                | OpenCode's `execute` replaces Pi's `exec`; translate nested calls into Halo's `ToolExecution`.                                                      |
| Existing Executor integrations   | Aligned through bridge | Register a Code Mode tool that delegates to the workspace `ToolRuntime` while integrations migrate.                                                 |
| Remote workspace/tool execution  | Gap                    | Connect the control-plane server to `apps/workspace-server` through a workspace driver or Halo tool RPC bridge.                                     |
| Extension permissions            | Partial                | Keep `ToolRuntime` as the authority first; later port grants to OpenCode permissions.                                                               |
| Google/OpenAPI integrations      | Gap                    | Build OpenCode plugins or MCP servers for discovery, OAuth, credentials, and dynamic schemas before removing Executor.                              |
| Server inside Halo's Node 22 app | Blocked                | OpenCode 2.0.2 has an incompatible Effect graph and its published server imports do not load under stock Node 22. Run an isolated Bun server first. |

The full server package adds roughly 500 installed dependencies in isolation. That footprint belongs in the control-plane image, not on the device. The device can depend on the much smaller network client package.
