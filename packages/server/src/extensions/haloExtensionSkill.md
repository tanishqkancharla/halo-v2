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

## Sidebar name and icon

Set optional presentation fields in `package.json`:

```json
{
  "name": "calendar-day-view",
  "halo": {
    "displayName": "Calendar",
    "icon": "Calendar"
  }
}
```

`displayName` appears in the sidebar, pane header, and permission UI. If omitted, Halo uses the extension ID. The directory ID still identifies commands, routes, storage, and grants. Keep existing `halo.capabilities` when editing these fields.

`icon` is an exact, case-sensitive Maui icon export name. Search the installed package from the extension directory:

```sh
rg -i 'calendar|clock' node_modules/maui/src/icons/index.ts
```

The matching exports give the names to use. Inspect the corresponding source file, such as `node_modules/maui/src/icons/Calendar.tsx`, if needed. With no icon, or a name unavailable in Halo's Maui version, the sidebar shows only the label.

Reload Halo's renderer to pick up name and icon edits. No extension rebuild or server restart is needed for those fields.

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

## Test the requested behavior

Choose the server that can exercise the requested behavior. Extensions using connected services or workspace tools must be tested on their Halo-hosted URL; a standalone preview cannot prove tool access. Use a standalone preview with isolated data for extension-owned storage and layout checks.

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

## Workspace tools and connected services

Hosted extension API handlers receive `context.tools`. Calls go through Halo's existing tool runtime and connected accounts. Keep these calls in `api.ts`; the view calls your API. Never copy provider credentials into extension source or frontend code.

Request the tools the extension needs:

```sh
halo extension tools add notes files.read
halo extension tools status notes
```

`tools add` updates `halo.capabilities` in the extension's `package.json` and asks the user to approve access in Halo. It returns `awaiting-approval` until the user approves; it does not wait for their answer or grant itself permission. Previously approved tools remain available. Unavailable tool paths are reported as `missing` rather than silently approved.

The user can decline the request or revoke access using the **Permissions** icon in the extension header. Halo stores approvals separately from the manifest and checks them on every call. Removing a capability revokes its approval when Halo next checks the manifest; adding it again requires approval again.

Declare the types of the tools your handler consumes, then call them as you would from the agent's tool runtime:

```ts
import { os, type ExtensionToolResult } from "@get-halo/extension-sdk/api";

const api = os.$context<{
  tools: {
    files: {
      read(input: {
        path: string;
      }): Promise<ExtensionToolResult<{ path: string; text: string }>>;
    };
  };
}>();

export default {
  notes: api.handler(async ({ context }) => {
    const result = await context.tools.files.read({ path: "notes.txt" });
    if (!result.ok) throw new Error(result.error.message);
    return result.data.text;
  }),
};
```

Tool paths and inputs match Halo's live catalog, including connected services. The example's types describe the existing file tool contract; service tool types must match their actual schema. Handle failed calls and show their errors in the view. Granting a tool does not connect an account; if a service is disconnected, have the user connect it in Halo. Do not substitute sample records for live service data.

For testing tool access, open the hosted extension URL with `halo browser`. A standalone `npm start` preview still supports its own API and storage, but tool calls return `halo_not_connected` unless Halo supplied the tool connection.

In Halo's development app, `halo extension new` builds and installs the repository's local SDK and build tools as npm tarballs. No publishing is needed. After changing those packages, run `halo extension update <id>` to install the current local builds into an existing extension, typecheck it, and rebuild. Restart Halo to load the rebuilt server. These commands build on demand; they do not start a watcher.

The released app uses published npm packages. The published SDK 0.1.0 does not supply `context.tools`; use the development app's local packages until the bridge is released. A TypeScript context declaration describes the runtime; it does not supply missing tools.

Before reporting completion, exercise the user's main workflow in the hosted view and verify the actual result. For a calendar, wait for a successful events request and confirm the events render, or confirm that a successful response contains no events. Clicking Next day and seeing the heading change does not verify calendar access. Check failed API responses and visible error states as well as browser errors; `errors: []` does not mean that a caught API failure succeeded.

If permission, account connection, or a platform dependency prevents the main workflow, report the task as blocked or incomplete and name the missing step. Do not describe a broken integration as completed with a caveat. Keep reusable browser checks that assert the main result and fail when the view reports an error.
