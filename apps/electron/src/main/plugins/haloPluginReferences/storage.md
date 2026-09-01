# Storage reference

Use storage for plugin-owned records that must survive reloads and stay in the workspace. Do not use `localStorage`, `sessionStorage`, cookies, or an invented persistence file.

Storage needs all three parts:

1. `storage.ts` defines collections with `defineSchema`, `collection`, and `t` from `@get-halo/plugin-sdk/storage`.
2. `server.ts` spreads `syncRoutes(tables)` into its router. Halo stores synced data at `.halo/plugin-data/<id>/store.json`.
3. Each view hook that reads or writes records wraps its tree in `PluginStorageProvider tables={tables}`.

Use `halo plugin new <id> --storage` to start from a complete working setup.

The transaction methods are:

- `tx.set(collection, fullRecord)` inserts or replaces a record.
- `tx.get(collection, id)` reads one record in the current transaction.
- `tx.list(collection)` reads the collection in the current transaction.
- `tx.update(collection, id, record => nextRecord)` changes an existing record.
- `tx.remove(collection, id)` deletes a record.

The view hooks are:

- `usePluginQuery(query, deps)` returns matching rows and updates with storage.
- `usePluginEntity(collection, id)` returns one row by id.
- `usePluginTransaction(callback)` returns a function that opens and commits a transaction.

A schema alone does not persist data. Read `references/examples.md` for a full setup and the installed `storage.d.ts` and `view.d.ts` for current types.
