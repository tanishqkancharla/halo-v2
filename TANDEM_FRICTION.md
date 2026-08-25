# Tandem friction log

Notes from replacing TanStack Query in the Halo renderer with latest Tandem (`dc70f5f`, including `@tandem/react`). Halo pins that commit in the git subpath specifiers so Electron and plugin-sdk share one tree.

## Install and packaging

1. Git packages still point `main` / `types` / `exports` at `dist`, and the published tree has no `dist`. Halo has to patch `@tandem/core`, `@tandem/server`, `@tandem/types`, and now `@tandem/react` onto `src`. pnpm 11 rejects a patch whose hunk header line counts do not match, so the patches have to be generated from the real `package.json` files.

2. Tandem packages declare `@tandem/core` and `@tandem/types` as `workspace:*`. A consumer git-install has to override both onto git subpaths, not only `@tandem/types`.

3. `@tandem/core` grew an `exports` map (`"."` and `"./node"`). Patching only `main` / `types` is no longer enough; Node/Vite follow `exports` and still resolve `dist`.

4. Copying the plugin-sdk closure into the packaged Electron app failed: `tuple-database/node_modules/.bin/uuid` is a dangling symlink under pnpm hoisting, and `fs.cp({ dereference: true })` throws `ENOENT`. Skipping nested `node_modules` inside a package (deps are copied as a closure anyway) avoids the dangling bin and a copy explosion.

## Query API vs async RPC

5. Tandem has no `queryFn`, `enabled`, `staleTime`, `refetchInterval`, `invalidateQueries`, or `setQueryData`. Halo RPC still lives in the main process. The renderer now hydrates Tandem collections from oRPC, then reads with `useTandemQuery` / `useEntity`.

6. There is no loading/error/fetched state on a query. An empty collection is the same shape as "not loaded yet". Halo added a `loads` collection (`ready` / `error`) to recover `isPending` / `isFetched`.

7. There is no mutation helper for async RPC. `useTandemTransaction` only writes local rows and does not return pending/error. Halo added an `actions` collection for choose-workspace, install-update, and OAuth pending flags.

8. `TandemClientProvider` always starts `isReady` as false and flips it in an effect, even when `client.ready` is already resolved (in-memory, no storage). Combined with Halo's RPC bootstrap, the first paint is two loading screens.

9. Default `TandemClientProvider` fallback is `null`. Halo has to pass `fallback={<LoadingPage />}` (`unicorn/no-null`).

10. Subscribe still does not emit the first result through the callback. `@tandem/react` copies `result` into state after `subscribe`, which is the same workaround plugin-sdk already documented.

11. Query identity is `JSON.stringify(query)`. That is enough for Halo's static query objects. There is no `enabled: false`; passing `undefined` into `useTandemQuery` is the skip path.

12. `useTandemTransaction` always calls `flushStorage()` after commit. Halo's host client has no storage adapter, so this is a no-op, but the hook still is not usable for RPC.

## Schema

13. `t` is only `id` / `string` / `number` / `boolean`. Nested objects and arrays (`AppInfo.update`, `IntegrationConnection.scopes`, session titles) are stored as extra record fields by using `collection<Row>({ fields })` without a shape. They persist in memory but are not first-class field types.

14. `keyof` on a union row type is only the common keys. A workspace discriminated union could not list `name` / `workspaceRoot` / `message` in `fields`. Halo flattened that row instead.

15. Every record needs an `id`. Session summaries use `sessionId` on the wire, so Halo maps `sessionId` ↔ `id` at the Tandem boundary.

16. `CollectionName` is not re-exported from `@tandem/core`. Halo imports it from `@tandem/types`.

17. Default `Logger` / `ConsoleLoggerSink` logs every commit. The todo example uses a silent logger; Halo copied that. Without it the renderer console is unusable.

18. Latest core moved `node:fs` into `@tandem/core/node` (`Logger.node.ts`). Halo could drop the Vite `node:fs` shim that the previous Logger required in the renderer.

## Data that is not a record

19. `HaloClient` is a live oRPC proxy. It cannot live in Tandem. Bootstrap is still `useState` + `useEffect` around `createApi()`. The proxy is a function, and React `setState(client)` treats that as an updater (`client(prevState)`), which calls the root procedure and stores the RPC promise. Store it with `setApi(() => client)`. TanStack Query did not have this trap because `queryFn` return values are not updater functions.

20. Plugin views are React components and plugin servers are proxies. They cannot live in Tandem. Halo writes plugin ids / errors as rows and keeps views/servers in module maps. StrictMode remounts have to refill those maps before the collection write, or `useTandemQuery` races an empty map.

21. Live workspace file events used to patch a TanStack cache entry without resetting the tree. A Tandem path-collection write re-renders `Filesystem`, which calls `resetPaths` and fights Pierre's incremental model. Halo still only writes path rows when emptiness flips, and applies file events to the tree model directly.

22. App info polling (`refetchInterval: 5000`) is a `setInterval` in a hydrator.

23. Session list refresh after prompt used `invalidateQueries`. Halo now re-lists sessions and `replaceCollection`s. Tandem has no "refetch this query" API.

## Overlap with plugin-sdk

24. `@halo/plugin-sdk` already wraps `TandemClient.subscribe` as `usePluginQuery` / `usePluginTransaction` / `usePluginEntity`. `@tandem/react` is the same idea with different names and query identity (`JSON.stringify` vs caller `deps`). The host app and plugins now have two React bindings.

25. Plugin-sdk still constructs `TandemClient` by hand and does not use `TandemClientProvider`.
