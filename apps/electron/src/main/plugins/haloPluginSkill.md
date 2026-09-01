---
name: halo-plugin
version: 1
description: Create or edit a Halo plugin that adds workspace UI, server procedures, persistent data, or access to granted tools.
---

# Halo plugins

You can create Halo plugins that change how Halo looks and works. Plugins live in `.halo/plugins/<id>/` inside the selected workspace. Write plugin code only in that folder; do not edit Halo itself.

Halo must be running because the `halo` CLI talks to the open app.

## Work loop

1. `halo plugin new <id>` scaffolds the plugin and installs the contract for the running Halo version.
2. Edit only that plugin's source files.
3. `halo plugin types` refreshes the local SDK contract and typechecks every plugin.
4. If the plugin requests host tools, follow the connection and grant flow below.
5. `halo plugin build` compiles every plugin view and remounts plugin servers.
6. `halo plugin <id> <procedure> --input '<json>'` checks a non-streaming server procedure.
7. Reload Halo after a build to render the new view bundle.

`types` and `build` act on every workspace plugin. Report errors from unrelated plugins instead of changing them.

## Layout

A plugin can have these files:

- `package.json` is required. It declares the plugin, its optional entry points, and the host tools it requests.
- `view.tsx` is optional. It runs in Halo's renderer and exports the `Sidebar` and `Routes` UI hook points.
- `server.ts` is optional. It runs in Halo's main process and exposes oRPC procedures to views and the CLI.
- `storage.ts` is optional. It defines typed Tandem collections for plugin-owned persistent data.

Plugins may be UI-only, server-only, or both. `storage.ts` is not an entry point; the view and server import its schema to connect the two sides of storage.

Halo finds view entries at `view.tsx`, `view/index.tsx`, `view.ts`, or `view/index.ts`, and server entries at `server.ts` or `server/index.ts`. Set an explicit manifest path only when using another location.

## Metadata

`package.json` must have a non-empty package `name` and a `halo` object with:

- `version: 1`
- a non-empty `name`, shown in Halo
- optional `description`
- optional `view` and `server` entry paths
- optional `capabilities`, containing exact canonical host tool paths

Pin `@get-halo/plugin-sdk` in `devDependencies` to the running Halo version exactly. This pin is the plugin's contract with the host. A missing or different version prevents typechecking, building, and loading. Let `halo plugin new` and `halo plugin types` install the contract.

## View

The view is one browser bundle with two independent React mount points:

- `Sidebar` mounts in Halo's left sidebar. Use it for navigation or small status UI. `SidebarSection` supplies the section title. An active `SidebarItem` uses its `pageTitle` and section title to fill Halo's shared page header.
- `Routes` mounts in the main pane below Halo's shared header at `/plugins/<id>`. Use it for the plugin's pages. Routes and sidebar links are relative to the plugin base.

Exporting one hook does not require the other. A view with neither export is empty. The hooks do not share a React tree, so component state and custom context do not cross between them.

Halo mounts each hook inside a `PluginServerProvider`. When the plugin has a server, call it with `usePluginServer<typeof router>()` and import the router from `server.ts` as a type only.

Always read the `maui` skill before writing view code. Halo already provides `MauiProvider`. Import React, Maui, purse-styles, and wouter from their public packages. `@get-halo/plugin-sdk/view` contains Halo-owned providers, hooks, and sidebar components. Do not use raw HTML controls.

`halo plugin build` writes `dist/view.js`; do not compile it yourself. Halo supplies React, Maui, purse-styles, wouter, and the Halo view and storage SDKs at runtime. The build bundles other plugin dependencies.

## Server

The server exports an oRPC router. Each procedure becomes a callable path. Views call procedures through `usePluginServer`; the CLI calls them with `halo plugin <id> <procedure>`.

Procedures are request handlers, not lifecycle hooks. Halo runs one only when a view, the CLI, or another host caller invokes its path. Each handler receives:

- `pluginId`, the mounted plugin
- `workspaceRoot`, the selected workspace
- `tools`, the plugin's granted host-tool facade

Use `pluginOs` from `@get-halo/plugin-sdk/server` so handlers receive that context. Prefer a default router object. Nested router objects create dotted procedure paths.

Builds reload server modules without a module cache. Return an `Error` from a handler to fail its RPC call. The renderer can consume streaming procedures, but the CLI supports non-streaming calls only.

## Storage

Use storage for plugin-owned data that must survive reloads and remain in the workspace. Define collections in `storage.ts` with `defineSchema`, `collection`, and `t` from `@get-halo/plugin-sdk/storage`.

A schema does not persist anything by itself. Connect both sides:

1. Spread `syncRoutes(tables)` into the server router. This adds `sync.push`, `sync.pull`, and `sync.connect` and persists data at `.halo/plugin-data/<id>/store.json`.
2. Wrap each view hook that uses storage in `PluginStorageProvider tables={tables}`. Wrap `Sidebar` separately when it uses storage because it does not share the `Routes` tree.

Inside the provider, use `usePluginQuery`, `usePluginEntity`, and `usePluginTransaction`. Use ordinary server procedures for work that is not persistent collection state.

Do not use `localStorage`, `sessionStorage`, cookies, or an invented persistence file. They bypass Halo's workspace-backed plugin state.

## Host tools

Plugins do not inherit the agent's tools. Only server procedures can call host tools, through `context.tools`.

Access has two gates:

1. The plugin requests exact canonical paths in `halo.capabilities`.
2. The user grants requested paths that exist in the live catalog.

Declaring a path does not grant it. Use `halo plugin check <id>` before asking for a grant. Removing a declared path revokes it; adding it later requires a new grant.

Connections and grants are separate. A granted integration tool still needs its normal Executor connection. Never put credentials in plugin code or storage.

Host tool calls return either `{ ok: true, data }` or `{ ok: false, error }`. Handle both in the server procedure.

### When an integration is not connected

Use this order:

1. Search for the needed operation and inspect saved connections. If no matching operation exists, do not assume that the integration is unavailable.
2. Search configured integrations with `tools.executor.integrations.list`. Choose the integration that fits the requested job. If several choices would change the result, ask the user which one to use.
3. Call `tools.halo.showConnectionCard({ integration })`. This only shows an optional card, so do not ask for confirmation first.
4. Keep creating the plugin while the card waits. Build every part that does not depend on the live connection, but do not guess canonical tool paths or claim that access was granted.
5. Tell the user to sign in through the connection card. Halo will notify you and resume the session when sign-in finishes.
6. After Halo resumes, search again for the now-connected operations and inspect their schemas. Add only the exact paths the plugin needs to `halo.capabilities` and use those paths in the server.
7. Run `halo plugin check <id>`, then `halo plugin grant <id>`. Finish the normal typecheck, build, procedure check, and reload steps.

## Find current details

Do not carry large API examples in this skill. When a detail is unclear, inspect the generated scaffold, run the relevant `halo ... --help`, or read the declarations in the plugin's installed `@get-halo/plugin-sdk`. Those sources match the running Halo version and take precedence over remembered syntax.
