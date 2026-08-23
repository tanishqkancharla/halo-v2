---
name: halo-plugin
version: 1
description: >
  Create or edit a Halo plugin in the current workspace. Use when the user
  asks to add a sidebar view, a main-pane page, or a plugin server.
---

# Halo plugins

Plugins live in `{workspace}/.halo/plugins/<id>/`. The folder name is the plugin id. `halo.name` is the label in the UI.

Write plugin code only in that folder. Do not edit Halo app source.

Halo must be running. Use the `halo` CLI (on PATH in the app, or `pnpm halo` in the Halo repo). `new`, `build`, and `types` are reserved ids.

1. `halo plugin new <id>` — scaffold the plugin folder
2. Edit sources in that folder
3. `halo plugin types` — refresh declarations and typecheck. Fix errors here.
4. `halo plugin build` — write `dist/view.js`
5. Reload (View → Reload, or Cmd-R / Ctrl-R)
6. `halo plugin <id> <endpoint>` — call the plugin server (example: `halo plugin notes ping`)

Do not compile the view yourself. Halo reads `dist/view.js` on load. A missing file is a load error for that plugin only.

## Layout

Required:

- `package.json` with a nested `halo` object
- `halo.version` set to `1`
- `halo.name` set to a non-empty string

Optional:

- `view.tsx` (or `view/index.tsx`, `view.ts`, `view/index.ts`) with named exports `Sidebar` and `Routes`
- `server.ts` (or `server/index.ts`) with a default oRPC router
- `storage.ts` with Tandem collections from `@halo/plugin-sdk/storage`

## View bundle

`halo plugin build` compiles the view with esbuild. Packages Halo already ships are external: `react`, `maui`, `purse-styles`, `wouter`, `@halo/plugin-sdk/view`. Import UI from `@halo/plugin-sdk/view`. That module is Maui, purse-styles (`style`, `useStyles`), and wouter. Read the `maui` skill for tokens, shadows, focus, and Flex spacing. Import those names from `@halo/plugin-sdk/view`, not `"maui"`. Do not wrap `MauiProvider`. Do not `npm install` `react`, `maui`, `purse-styles`, or `wouter`.

Other packages are allowed. Add them to that plugin's `package.json`, run `npm install` in the plugin folder, then `halo plugin build`. esbuild inlines them. A missing package fails the build.

Import `pluginOs` and `syncRoutes` from `@halo/plugin-sdk/server`. Import `collection`, `defineSchema`, and `t` from `@halo/plugin-sdk/storage`. Parse JSON with `parseVersioned` from `@halo/plugin-sdk/schema`.

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

## Storage

The host does not wrap storage. If the plugin uses `syncRoutes`, wrap `PluginStorageProvider` in `Routes` and in `Sidebar` if the sidebar queries. Use `usePluginServer` for other RPC.

A complete todo plugin lives at `.halo/plugins/todos`. `halo.name` is `Todos`. `Sidebar` has a `SidebarItem` named `List`. `Routes` wraps `PluginStorageProvider` with `tables={todoTables}`, lists todos, and adds items with a field labeled `New todo` and a button named `Add`.

`storage.ts`:

```ts
import { collection, defineSchema, t } from "@halo/plugin-sdk/storage";

export const todoTables = defineSchema({
  todos: collection({
    id: t.id(),
    title: t.string(),
    done: t.boolean(),
  }),
});
```

`server.ts`:

```ts
import { syncRoutes } from "@halo/plugin-sdk/server";
import { todoTables } from "./storage.ts";

export default {
  ...syncRoutes(todoTables),
};
```

`package.json`:

```json
{
  "name": "halo-plugin-todos",
  "halo": {
    "version": 1,
    "name": "Todos",
    "description": "A list that survives reload.",
    "view": "./view.tsx",
    "server": "./server.ts"
  }
}
```

`view.tsx`:

```tsx
import { useState } from "react";
import {
  Button,
  Checkbox,
  Flex,
  H1,
  PluginStorageProvider,
  Route,
  SidebarItem,
  SidebarSection,
  Switch,
  TextField,
  usePluginQuery,
  usePluginTransaction,
} from "@halo/plugin-sdk/view";
import { todoTables } from "./storage.ts";

export function Sidebar() {
  return (
    <SidebarSection label="Todos">
      <SidebarItem href="/">List</SidebarItem>
    </SidebarSection>
  );
}

export function Routes() {
  return (
    <PluginStorageProvider tables={todoTables}>
      <Switch>
        <Route path="/" component={Home} />
      </Switch>
    </PluginStorageProvider>
  );
}

function Home() {
  const todos = usePluginQuery({ collection: "todos" });
  const addTodo = usePluginTransaction((tx, title: string) => {
    tx.set("todos", { id: crypto.randomUUID(), title, done: false });
  });
  const toggleTodo = usePluginTransaction(
    (tx, todo: (typeof todos)[number]) => {
      tx.set("todos", { ...todo, done: !todo.done });
    },
  );
  const [title, setTitle] = useState("");

  function add() {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    addTodo(trimmed);
    setTitle("");
  }

  return (
    <Flex column gap={4}>
      <H1>Todos</H1>
      <Flex gap={2}>
        <TextField
          aria-label="New todo"
          value={title}
          onChange={setTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
        />
        <Button onClick={add}>Add</Button>
      </Flex>
      <Flex column gap={2}>
        {todos.map((todo) => (
          <Flex key={todo.id} gap={2}>
            <Checkbox
              label={todo.title}
              checked={todo.done}
              setChecked={() => {
                toggleTodo(todo);
              }}
            />
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
```
