---
name: halo-plugin
description: >
  Create or edit a Halo plugin in the current workspace. Use when the user
  asks to add a sidebar view, a main-pane page, or a plugin server.
---

# Halo plugins

Plugins live in `{workspace}/.halo/plugins/<id>/`. The folder name is the plugin id. `halo.name` is the label in the UI.

## Layout

Required:

- `package.json` with a nested `halo` object
- `halo.version` set to `1`
- `halo.name` set to a non-empty string

Optional:

- `view.tsx` (or `view/index.tsx`, `view.ts`, `view/index.ts`) with named exports `Sidebar` and `Routes`
- `server.ts` (or `server/index.ts`) with a default `RpcTarget` class

Do not add extra npm dependencies. Import UI from `@halo/plugin-sdk/view`. Import `RpcTarget` from `@halo/plugin-sdk/server`. Parse JSON with `parseVersioned` from `@halo/plugin-sdk/schema`.

Halo loads plugins once when the workspace is ready. Restart Halo to pick up edits.

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

`Sidebar` mounts in the app sidebar only when you export it. `Routes` fills the main pane at `/plugins/<id>`. Both are React components. Use wouter `Link` and `Route` from the SDK. Plugin links are relative to `/plugins/<id>`.

```tsx
import { Link, Route, Switch } from "@halo/plugin-sdk/view";

export function Sidebar() {
  return <Link href="/">Notes</Link>;
}

export function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
    </Switch>
  );
}

function Home() {
  return <div>Notes</div>;
}
```

A view that exports neither `Sidebar` nor `Routes` is empty, not an error. Import the server as a type only:

```ts
import type { NotesServer } from "./server.ts";
import { usePluginServer } from "@halo/plugin-sdk/view";
```

## Server

Export a class that extends `RpcTarget`. The host constructs it with `{ pluginId, workspaceRoot }`. Return an `Error` from a method to fail the RPC call.

```ts
import { RpcTarget, type PluginServerContext } from "@halo/plugin-sdk/server";

export default class NotesServer extends RpcTarget {
  constructor(private readonly ctx: PluginServerContext) {
    super();
  }

  ping() {
    return { pluginId: this.ctx.pluginId };
  }
}
```

In the view:

```ts
const server = usePluginServer<NotesServer>();
await server.ping();
```
