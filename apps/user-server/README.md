# User server

`apps/user-server` runs Halo's workspace, agent, integrations, and extensions in
an independent Node process. Its workspace package name is `@get-halo/server`.
Electron is an HTTP client: it neither starts nor stops this process.

## Development

Choose the workspace when starting development:

```sh
HALO_WORKSPACE_ROOT=/absolute/path/to/workspace pnpm dev
```

Run this from the repository root. The workspace directory must already exist.
Turbo starts the user server and Electron as separate development services.
The server reads the repository's `.env`; `HALO_WORKSPACE_ROOT` can be set there.
Both services use `<repo>/.halo` for local application data. Set `HALO_USER_DATA`
to use a different shared directory.

Electron waits for the server to publish its connection. Closing Electron
leaves the server, active conversations, and extensions running. To change
workspaces, restart the server with a different `HALO_WORKSPACE_ROOT` and reload
Electron.

## Explicit launch configuration

Start only the server with a JSON configuration file:

```sh
pnpm server /absolute/path/to/config.json
```

```json
{
  "workspaceRoot": "/absolute/path/to/workspace",
  "appDataDir": "/absolute/path/to/user-data",
  "appVersion": "0.0.0",
  "ownerUserId": "local-user",
  "logFilePath": "/absolute/path/to/user-data/logs/server.jsonl",
  "corsOrigins": ["http://localhost:1420", "null"]
}
```

Electron must use the same `appDataDir` through `HALO_USER_DATA`. Packaged
Electron also accepts its `--user-data-dir` argument. The server binds to loopback on an available port
and publishes `server.json` for Electron and `rpc.json` for the CLI. These files
contain distinct local bearer credentials and are written with mode `0600`.
Graceful server shutdown removes both files. Desktop reload reads the latest
connection, including after a server restart.

`HALO_LLM_CONFIG` selects the existing OpenAI-compatible inference transport.
Otherwise the process uses the same local Pi provider/model configuration as
before. See [the inference boundary](src/llm/README.md).

## Temporary credential storage

`FileCredentialVault` stores credential values as plain files under
`<workspace>/.halo/executor/credentials`, with directory mode `0700` and file
mode `0600`. Filenames are hashes of credential IDs. This deliberately temporary
store has no Electron or OS-keyring dependency; credentials will move to the
control plane in a later phase. Existing encrypted credential files are not
migrated.

## Ownership

```text
pnpm dev
├── user-server: tsx watch src/main.ts
│   ├── read launch configuration
│   ├── HaloServer.start()
│   └── publish local connection files
└── Electron
    └── read server.json → connect over HTTP RPC
```

The server retains the existing workspace files, conversation database, and
service APIs. Control-plane identity, hosted integrations, hosted inference,
and cloud provisioning are separate work.
