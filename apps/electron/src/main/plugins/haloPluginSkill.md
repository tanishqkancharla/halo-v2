---
name: halo-plugin
description: >
  Create or edit a Halo plugin in the current workspace. Use when the user
  asks to add a sidebar view, a main-pane page, or a plugin server.
---

# Halo plugins

Plugins live in `{workspace}/.halo/plugins/<id>/`. The folder name is the plugin id. `halo.name` is the label in the UI.

Write plugin code only in that folder. Do not edit Halo app source.

## Layout

Required:

- `package.json` with a nested `halo` object
- `halo.version` set to `1`
- `halo.name` set to a non-empty string

Optional:

- `view.tsx` (or `view/index.tsx`, `view.ts`, `view/index.ts`) with named exports `Sidebar` and `Routes`
- `server.ts` (or `server/index.ts`) with a default oRPC router

Halo loads plugins when the workspace is ready. Reload (View → Reload, or Cmd-R / Ctrl-R) to pick up plugin edits.

## View bundle

Halo compiles the plugin view with esbuild on load. Read `{{HALO_COMPILE_PLUGIN_VIEW}}` for the config it runs. Do not edit that file.

Packages in `external` are Halo's copies. Import UI from `@halo/plugin-sdk/view`. That module is Maui, purse-styles (`style`, `useStyles`), and wouter. Read the `maui` skill for tokens, shadows, focus, and Flex spacing. Import those names from `@halo/plugin-sdk/view`, not `"maui"`. Do not wrap `MauiProvider`. Do not `npm install` `react`, `maui`, `purse-styles`, or `wouter`.

Other packages are allowed. Add them to that plugin's `package.json`, run `npm install` in the plugin folder, then reload. esbuild inlines them. A missing package fails compile.

Import `pluginOs` from `@halo/plugin-sdk/server`. Parse JSON with `parseVersioned` from `@halo/plugin-sdk/schema`.

## package.json

```json
{
  "name": "halo-plugin-notes",
  "halo": {
    "version": 1,
    "name": "Notes",
    "description": "Scratch notes.",
    "view": "./view.tsx"
  }
}
```

## View

`Sidebar` mounts in the app sidebar only when you export it. `Routes` fills the main pane at `/plugins/<id>`. Both are React components. Use `SidebarSection` and `SidebarItem` for sidebar chrome. Plugin links are relative to `/plugins/<id>`.

```tsx
import {
  Flex,
  H1,
  Route,
  SidebarItem,
  SidebarSection,
  Switch,
} from "@halo/plugin-sdk/view";

export function Sidebar() {
  return (
    <SidebarSection label="Notes">
      <SidebarItem href="/">Scratch</SidebarItem>
    </SidebarSection>
  );
}

export function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
    </Switch>
  );
}

function Home() {
  return (
    <Flex column gap={4}>
      <H1>Notes</H1>
    </Flex>
  );
}
```

A view that exports neither `Sidebar` nor `Routes` is empty, not an error. Import the server as a type only:

```ts
import type router from "./server.ts";
import { usePluginServer } from "@halo/plugin-sdk/view";
```

## Server

Export a default oRPC router. Handlers read `{ pluginId, workspaceRoot }` from context. Return an `Error` from a handler to fail the RPC call.

```ts
import { pluginOs } from "@halo/plugin-sdk/server";

const plugin = pluginOs;

export default {
  ping: plugin.handler(async ({ context }) => ({
    pluginId: context.pluginId,
  })),
};
```

You can also export a named `router` or `Server` object. Do not export a class or function.

In the view:

```ts
const server = usePluginServer<typeof router>();
await server.ping();
```
