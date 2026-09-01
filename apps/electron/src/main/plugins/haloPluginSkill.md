---
name: halo-plugin
version: 1
description: Create or edit a Halo plugin that adds workspace UI, server procedures, persistent data, or access to granted tools.
---

# Halo plugins

Use this skill when work creates or changes a plugin. Plugins live in `.halo/plugins/<id>/` in the selected workspace. Change only that plugin folder, not Halo itself.

Halo must be running because the `halo` CLI talks to the open app.

## Start with the right references

Read only the references needed for the plugin:

- For renderer hooks, navigation, server calls, and Maui usage, read `references/view.md`.
- For procedures, handler context, streaming, and host tools, read `references/server.md`.
- For persistent records and sync, read `references/storage.md`.
- Before inventing an API shape, read `references/examples.md` and the installed declarations in the plugin's `node_modules/@get-halo/plugin-sdk/dist/`.

The installed declarations match the running Halo version and take priority over examples and remembered syntax. Also read the `maui` skill before writing view code.

## Plugin files and hook points

- `package.json` declares the plugin, its entry points, and requested host tools.
- `view.tsx` runs in the renderer. Its exported `Sidebar` and `Routes` functions are separate React mount points.
- `server.ts` runs in the main process. Its default router exposes procedures to the view and CLI; procedures run only when called.
- `storage.ts` defines plugin-owned persistent collections. It is not an entry point. Both the view and server import it to connect storage.

A plugin may be view-only, server-only, or both. Halo finds view entries at `view.tsx`, `view/index.tsx`, `view.ts`, or `view/index.ts`, and server entries at `server.ts` or `server/index.ts`. Use explicit manifest paths only for other locations.

## Work loop

1. Decide which data belongs to the plugin and which belongs to an existing service. Search integrations before treating service-backed data as local plugin data.
2. If a needed service is not connected, show its connection card immediately and keep working on independent parts.
3. Run `halo plugin new <id>`. Add `--storage` only for plugin-owned persistent records.
4. Edit the scaffold instead of replacing its working setup.
5. Run `halo plugin types` often. It checks every workspace plugin against its installed dependencies.
6. Run `halo plugin build` to compile views and remount servers.
7. Check non-streaming procedures with `halo plugin <id> <procedure> --input '<json>'`.
8. Ask the user to reload Halo so the new view bundle appears.

`types` and `build` act on every workspace plugin. Report errors from unrelated plugins instead of changing them.

## Manifest

`package.json` needs a non-empty package `name` and a `halo` object with:

- `version: 1`
- a non-empty display `name`
- optional `description`
- optional `view` and `server` paths
- optional `capabilities` with exact canonical host-tool paths

Pin `@get-halo/plugin-sdk` in `devDependencies` to the running Halo version. A missing or different version blocks typechecking, building, and loading. Let `halo plugin new` install dependencies; do not copy declarations into the plugin.

## Integration connection and grant flow

Plugins do not inherit the agent's tools. A server can call a host tool only after the plugin requests its exact path and the user grants it. An integration must also be connected.

Do not replace data from an existing service with plugin storage, placeholder data, or a UI-only imitation unless the user asks for a local-only version. Plugin storage is for state the plugin owns and may sit alongside service data.

When the needed integration is not connected:

1. Search available operations and saved connections. If the operation is absent, search configured integrations with `tools.executor.integrations.list`.
2. Choose the matching integration. Ask the user only if several choices would change the result.
3. Call `tools.halo.showConnectionCard({ integration })` without asking first. The card is only an optional sign-in request.
4. Keep building all parts that do not need the live connection. Do not guess tool paths or claim access yet.
5. Tell the user to sign in through the card. Halo resumes the session after sign-in.
6. Search the connected operations again and inspect their schemas. Add only the exact needed paths to `halo.capabilities` and call them from the server.
7. Run `halo plugin check <id>`, then `halo plugin grant <id>`, followed by the normal typecheck and build steps.

Removing a declared path revokes it. Never put credentials in plugin code or storage.

## CLI discovery

Run `halo --help`, `halo plugin --help`, or a subcommand's `--help` when syntax is unclear. Do not invent a `halo reload` command.
