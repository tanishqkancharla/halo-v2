# Tandem friction log

Notes from serving Halo app state from a main-process Tandem remote (`dc70f5f`, including `@tandem/react`). Halo pins that commit in the git subpath specifiers so Electron and plugin-sdk share one tree.

The host writes records through a `TandemClient` attached to `InMemoryRemote`. The renderer is another `TandemClient` whose `remote` is `orpcSyncRemote(api.sync)`. React reads with `useTandemQuery` / `useEntity`. Commands that need the OS, Pi, or a plugin stay oRPC: choose folder, session prompt/open/events, plugin invoke/create/build, OAuth, install update.

## Install and packaging

1. Git packages still point `main` / `types` / `exports` at `dist`, and the published tree has no `dist`. Halo has to patch `@tandem/core`, `@tandem/server`, `@tandem/types`, and `@tandem/react` onto `src`. pnpm 11 rejects a patch whose hunk header line counts do not match, so the patches have to be generated from the real `package.json` files.

2. Tandem packages declare `@tandem/core` and `@tandem/types` as `workspace:*`. A consumer git-install has to override both onto git subpaths, not only `@tandem/types`.

3. `@tandem/core` grew an `exports` map (`"."` and `"./node"`). Patching only `main` / `types` is no longer enough; Node/Vite follow `exports` and still resolve `dist`.

4. Copying the plugin-sdk closure into the packaged Electron app failed: `tuple-database/node_modules/.bin/uuid` is a dangling symlink under pnpm hoisting, and `fs.cp({ dereference: true })` throws `ENOENT`. Skipping nested `node_modules` inside a package (deps are copied as a closure anyway) avoids the dangling bin and a copy explosion.

## Sync model

5. The sync engine only pulls scan windows a client is subscribed to. A replica must `subscribe(...)` or `pullFromRemote()` before it sees another client's writes. `TandemClientProvider` `ready` is storage, not the first pull. Halo treats a missing `workspaces` row as loading.

6. `RemoteServer.push` throws if that `clientId` is not connected. The host client uses `autoConnect: false` and `await connect()` before the first commit.

7. Host writes have to go through `TandemClient.commit`, not `store.loadRecords`. Only `push` applies mutations, pokes other clients, and advances the mutation log.

8. `InMemoryRemote` pokes clients whose last scan window intersects the mutation. The renderer has to subscribe before it will be poked. First paint subscribes to `workspaces` via `useEntity`.

## Query API vs commands

9. Tandem has no `queryFn`, `enabled`, `staleTime`, `refetchInterval`, `invalidateQueries`, or `setQueryData`. Reads are collections. Commands stay oRPC. The renderer does not write host collections.

10. There is no loading/error/fetched state on a query. An empty collection is the same shape as "not loaded yet". Halo uses the singleton workspace row as the ready gate. Session, plugin, and path lists can be empty for a ready workspace.

11. `useTandemTransaction` only writes local rows. Choose-workspace, install-update, and OAuth pending flags are React state.

12. Subscribe still does not emit the first result through the callback. `@tandem/react` copies `result` into state after `subscribe`.

13. Query identity is `JSON.stringify(query)`. There is no `enabled: false`; passing `undefined` into `useTandemQuery` is the skip path.

14. Default `TandemClientProvider` fallback is `null`. Halo passes `fallback={<LoadingPage />}` (`unicorn/no-null`).

## Schema

15. `t` is only `id` / `string` / `number` / `boolean`. Nested objects and arrays (`AppInfo.update`, `IntegrationConnection.scopes`) are stored as extra record fields by using `collection<Row>({ fields })` without a shape.

16. `keyof` on a union row type is only the common keys. A workspace discriminated union could not list `name` / `workspaceRoot` / `message` in `fields`. Halo flattened that row instead.

17. Every record needs an `id`. Session summaries use `sessionId` on the wire, so Halo maps `sessionId` ↔ `id` at the Tandem boundary.

18. `CollectionName` is not re-exported from `@tandem/core`. Halo imports it from `@tandem/types`.

19. Default `Logger` / `ConsoleLoggerSink` logs every commit. The todo example uses a silent logger; Halo copied that.

## Data that is not a record

20. `HaloClient` is a live oRPC proxy. It cannot live in Tandem. Bootstrap is still `useState` + `useEffect` around `createApi()`. The proxy is a function, and React `setState(client)` treats that as an updater. Store it with `setApi(() => client)`.

21. Plugin views are React components. Compiled `source` lives in `pluginViews`. The renderer evaluates that source. Plugin servers are still oRPC facades over `plugins.invoke`.

22. Live workspace file events still stream through `workspace.events` so Pierre can patch the tree. Path snapshots live in Tandem; the main tree listener updates those rows.

## Overlap with plugin-sdk

23. `@halo/plugin-sdk` already wraps `TandemClient.subscribe` as `usePluginQuery` / `usePluginTransaction` / `usePluginEntity`, and serves plugin data with `RemoteServer` + `syncRoutes`. The host app now uses the same remote shape (`push` / `pull` / `connect`) via `haloSyncRemote`. React bindings still differ: `@tandem/react` vs the plugin-sdk hooks.
