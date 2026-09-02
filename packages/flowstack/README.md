# flowstack

Serve Halo's event flows as an expandable call stack page.

```sh
pnpm flowstack
pnpm flowstack --port 4188 --host 0.0.0.0
```

Options:

- `--port <n>` — listen port (default `4188`)
- `--host <addr>` — listen host (default `127.0.0.1`)
- `--root <dir>` — repository root for source excerpts (default the directory you ran the command from)

## Model

`src/model/Program.ts` frames a program as a DAG of services. Events cross the boundary in both directions. A flow is one inbound event and its path:

```text
[E_in, S, E_out]
```

Click into `S` and the same path reads through the services `S` composes:

```text
[E_in, [A, hop, B, hop, C], E_out]
```

Each frame names a service and an entry point. A frame either has an `inner` path (open it to go one level down) or a `source` range (open it to read the lines). Services list the state they store.

`src/model/halo.ts` holds Halo's services and four flows: sending a prompt, a file changing on disk, app launch, and an OAuth callback.

## Page

- Sidebar: the program map (composition DAG plus a state table) and the flows.
- Call stack: the path with `in` / `then` / `out` event rows between frames. Chevrons open inner paths; the code button on a frame with both opens its source.
- Sequence: the same level of the flow as a Mermaid sequence diagram.

Source excerpts come from `/__flowstack/file?path&start&end`, read from the repository root. The server accepts any `Host` header so a tunnel can front it.
