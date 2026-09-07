---
name: halo-extension
description: Create or edit a Halo extension with a web view, API routes, and shared persistent data. Use for requests to build workspace apps, panes, or plugins.
---

# Halo extensions

Extensions are standalone web apps in `.halo/extensions/<id>/` inside the selected workspace. Work in that extension's directory. Halo hosts its server and displays its view in an iframe; each browser has its own navigation and UI state. Tandem synchronizes shared records between views.

## Create and build

With Halo running and a workspace open:

```sh
halo extension new my-extension
cd .halo/extensions/my-extension
```

The command writes the starter and installs its npm dependencies. The host needs `node` and `npm` on PATH; Electron's embedded runtime does not supply these commands. Use `halo extension --help` for CLI discovery.

Use the workspace file tools to read and write source and the Bash tool to run commands. Adapt the starter's normal npm project:

- `view.tsx` default-exports a React component. It runs at `/view/`; nested `/view/...` URLs load the same app and can be routed inside the view.
- `api.ts` default-exports an oRPC router, mounted at `/api/`. Import `os` from `@get-halo/extension-sdk/api` to define handlers.
- `schema.ts` default-exports a Tandem schema. The SDK mounts `/sync/` and connects storage automatically.

Read the workspace's `.agents/skills/maui/SKILL.md` before designing the view. Maui's source references such as `src/patterns/` are relative to the extension's `node_modules/maui/`. Use its components and keep `MauiProvider` in the view. Each extension installs and bundles its own UI dependencies; Halo does not inject React or Maui into the iframe.

Read the installed SDK declarations and README in `node_modules/@get-halo/extension-sdk/` for the version this extension uses. The build tools' README is in `node_modules/@get-halo/extension-tools/`.

After editing, run inside the extension directory:

```sh
npm run typecheck
npm run build
```

One build compiles the view, API, and schema together. It writes `dist/start.mjs` and selects a complete build through `dist/current.json`. Use the generated build configuration; do not compile panes separately or edit generated output.

## API and shared data

The view receives `{ api, storage }`, typed with `ExtensionViewProps<typeof router, typeof schema>` from `@get-halo/extension-sdk/view`. Import the router and schema as types in the view. A handler such as `hello: os.handler(() => "Hello")` in `api.ts` is called as `await api.hello()`.

For extension-owned records, define collections in `schema.ts`:

```ts
import { collection, defineSchema, t } from "@get-halo/extension-sdk/schema";

export default defineSchema({
  tasks: collection({ id: t.id(), label: t.string(), done: t.boolean() }),
});
```

Use `useQuery` from `@get-halo/extension-sdk/view` with a stable query object, for example `const tasksQuery = { collection: "tasks" } as const` outside the component and `useQuery(storage, tasksQuery)` inside it. To write a record, create a transaction with `storage.transact()`, call `tx.set("tasks", fullRecord)`, and await `storage.commit(tx)`. Handle a rejected API call or commit and show the failure in the view.

Use React state for local navigation and unfinished form input. Use Tandem for records that other views should see. Halo stores hosted data in `.halo/extension-data/<id>/store.json`; do not write that file directly or replace shared records with browser localStorage.

## Inspect independently, then load in Halo

For standalone inspection through the Bash tool, start the built server in the background inside the extension directory:

```sh
node dist/start.mjs --port 0 --data-dir .extension-data > .extension-preview.log 2>&1 < /dev/null & echo $!
```

Save the printed PID and read `.extension-preview.log` for the `/view/` URL. The Bash tool waits for a foreground command to finish, so keep this server in the background while inspecting it.

Test the actual view using Halo's browser commands through the Bash tool. Halo manages the browser runtime; the extension does not need to install Playwright to use these commands.

```sh
halo browser open http://127.0.0.1:<preview-port>/view/
# Use the returned browser ID in subsequent commands.
halo browser exec <id> 'await page.getByRole("textbox").fill("Milk"); await page.getByRole("button", { name: "Add" }).click();'
halo browser snapshot <id>
halo browser screenshot <id>
halo browser close <id>
```

`open` returns an ID, URL, title, accessibility tree, and runtime errors. Each open creates an isolated browser. Browser state survives CLI calls, but JavaScript variables do not. Each `exec` receives a live Playwright `page`; use `await` for actions and `return` for results. Read returned errors and snapshot changes. Use `halo browser list` to find open sessions.

Keep reusable checks in script files inside the extension and run `halo browser exec <id> --file checks.js`; `--stdin` also accepts a script. Drive actual controls using accessible roles and labels. Open the preview twice to verify shared records sync while local unfinished input stays local. Restart the preview and open a fresh browser to verify persistence. Use isolated preview data, not the user's hosted records.

Do not recreate the SDK's sync transport or manipulate persistence files to test the app. A successful HTTP fetch or build does not verify the rendered view. Read the PNG path returned by `screenshot` with the file tool to inspect layout. Close every browser you open when finished, including after a failed check.

`halo app snapshot`, `halo app exec`, and `halo app screenshot` deliberately control the user's Halo debug renderer. Use `halo browser` for extension testing so the user's app navigation stays theirs.

This standalone preview uses separate data from Halo. Stop the preview with `kill <saved-pid>` when finished. After source edits, rebuild and restart that preview to inspect the new build. A human running an interactive terminal can use `npm start -- --port 0 --data-dir .extension-data` instead.

To host a newly built extension in Halo, run `halo extension reload`. Halo starts its server. The user can reload Halo's renderer and open the extension's sidebar entry. When inspecting a hosted view, open its URL in a separate browser page without navigating the user's app chrome. Changes to Tandem records on this hosted server also reach the user's view; test mutations affect that shared data.

`halo extension reload` discovers and starts extensions that are not running yet, and stops servers for deleted extension directories. It does not rebuild or restart a running extension. For an existing hosted extension, verify edits in the standalone preview, then ask the user to restart Halo when ready to load the rebuilt version. A renderer reload alone does not replace the server's build.

## Remove an extension

Delete its directory under `.halo/extensions/`, then run `halo extension reload` to stop its server. Reload the renderer to refresh the sidebar. Extension records live separately under `.halo/extension-data/<id>/`; delete those only when the user wants the stored data removed too.

## Current boundaries

Halo currently supplies one sidebar entry per extension. The extension owns routing within its view. Declarative sidebar contributions, app-header actions, and named panes are not implemented.

Extension handlers currently receive an empty context. They do not inherit the agent's connected tools or credentials. Do not use the legacy plugin SDK, `context.tools`, plugin grants, or `halo plugin` commands for extensions. If the requested app needs live integration access, explain that the extension bridge is not connected yet; do not silently substitute sample data or local records for the service.
