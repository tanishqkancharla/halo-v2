---
name: halo-plugin
version: 1
description: >
  Create or edit a Halo plugin, which provides extension points to create and customize UI on the Halo app.
---

# Halo plugins

Plugins live in `{workspace}/.halo/plugins/<id>/`. The folder name is the plugin id. `halo.name` is the label in the UI.

Write plugin code only in that folder. Do not edit Halo app source.

Always read the maui skill before writing view code. Use Maui components and React hooks from `@get-halo/plugin-sdk/view`. Do not use raw HTML controls. Do not import from `"react"`, `"maui"`, or `"purse-styles"`.

If the plugin keeps data, add `storage.ts` and `syncRoutes`. Do not use `localStorage`, `sessionStorage`, cookies, or files you invent.

Plugins do not inherit the agent's tools. A plugin requests specific tools by listing their exact canonical paths in `package.json` under `halo.capabilities`, and its server calls those same paths through `context.tools`. Declaring a path does not grant it: check the request with `tools.plugins.check`, then explicitly add its current valid paths with `tools.plugins.grant`. Removing a declared path revokes it; adding it back requires a new grant. Connections and plugin grants are separate: connect integrations through Executor's normal connection flow, and never give credentials to plugin code.

Halo must be running. During agent work, use the following exact calls through exec:

1. `tools.plugins.create({ id })` — scaffold the plugin folder, pin `@get-halo/plugin-sdk` to this Halo version, and install that contract
2. Edit sources in the returned directory with `tools.files`
3. `tools.plugins.types({})` — typecheck every plugin. Fix all reported diagnostics.
4. `tools.plugins.check({ pluginId: id })` — compare requested capabilities with saved grants and the live tool catalog
5. `tools.plugins.grant({ pluginId: id })` — grant the currently declared paths that exist in the catalog
6. `tools.plugins.build({})` — build every plugin and remount its server
7. `tools.plugins.invoke({ pluginId: id, path: ["ping"], input: {} })` — check a non-streaming server procedure
8. Reload (View → Reload, or Cmd-R / Ctrl-R) to render view changes

Check every `{ ok, data/error }` result before continuing. `types` and `build` currently operate on every workspace plugin, so report unrelated plugin errors instead of changing those plugins.

The `halo` CLI remains available for humans and fallback debugging: `halo plugin new <id>`, `halo plugin types`, `halo plugin build`, and `halo plugin <id> <endpoint>`. `new`, `build`, and `types` are reserved ids.

Do not compile the view yourself. Halo reads `dist/view.js` on load. A missing file is a load error for that plugin only. A pin that is missing or not this Halo version is a load error for that plugin only.

## Layout

Required:

- `package.json` with a nested `halo` object
- `halo.version` set to `1`
- `halo.name` set to a non-empty string

Optional:

- `halo.capabilities` with exact Executor paths such as `files.read`
- `view.tsx` (or `view/index.tsx`, `view.ts`, `view/index.ts`) with named exports `Sidebar` and `Routes`
- `server.ts` (or `server/index.ts`) with a default oRPC router
- `storage.ts` with Tandem collections from `@get-halo/plugin-sdk/storage`

## View bundle

Pin `@get-halo/plugin-sdk` in `devDependencies` to the exact Halo app version, with no caret. A mismatch fails types, build, and load. Halo copies this app's contract into the plugin `node_modules`. A clone without Halo runs `npm install` for the same pin, then `tsc`. Run and rebuild still need Halo.

`halo plugin build` compiles the view with esbuild. Packages Halo already ships are external: `react`, `maui`, `purse-styles`, `wouter`, `@get-halo/plugin-sdk/view`. Import UI and hooks from `@get-halo/plugin-sdk/view`. That module is Maui, purse-styles (`style`, `useStyles`), wouter, and React hooks. Follow the maui skill. Do not wrap `MauiProvider`. Do not `npm install` `react`, `maui`, `purse-styles`, or `wouter`.

Other packages are allowed. Add them to that plugin's `package.json`, run `npm install` in the plugin folder, then `halo plugin build`. esbuild inlines them. A missing package fails the build.

Import `pluginOs` and `syncRoutes` from `@get-halo/plugin-sdk/server`. Import `collection`, `defineSchema`, and `t` from `@get-halo/plugin-sdk/storage`. Parse JSON with `parseVersioned` from `@get-halo/plugin-sdk/schema`.

## package.json

```json
{
  "name": "halo-plugin-notes",
  "halo": {
    "version": 1,
    "name": "Notes",
    "description": "Scratch notes.",
    "capabilities": ["files.read"],
    "view": "./view.tsx"
  },
  "devDependencies": {
    "@get-halo/plugin-sdk": "0.1.20"
  }
}
```

Use the running Halo version, not this example number.

## View

`Sidebar` mounts in the app sidebar only when you export it. `Routes` fills the main pane at `/plugins/<id>`. Both are React components. Use `SidebarSection` and `SidebarItem` for sidebar chrome. Plugin links are relative to `/plugins/<id>`.

The host paints that pane with `backgroundColor.app`. Follow the maui skill for page width: center ordinary pages at `proseMaxWidth`. Full pane width should be reserved for when you need it (horizontally dense tools, like tables, a CRM, kanban, or side-by-side panes).

```tsx
import {
  Flex,
  H1,
  Padding,
  Route,
  SidebarItem,
  SidebarSection,
  Switch,
  proseMaxWidth,
} from "@get-halo/plugin-sdk/view";

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
    <Padding xy={6}>
      <Flex
        column
        gap={4}
        style={{ width: "100%", maxWidth: proseMaxWidth, marginInline: "auto" }}
      >
        <H1>Notes</H1>
      </Flex>
    </Padding>
  );
}
```

A view that exports neither `Sidebar` nor `Routes` is empty, not an error. Import the server as a type only:

```ts
import type router from "./server.ts";
import { usePluginServer } from "@get-halo/plugin-sdk/view";
```

## Server

Export a default oRPC router. Handlers read `{ pluginId, workspaceRoot, tools }` from context. A declared and granted `files.read` path is called as `context.tools.files.read(input)`. Return an `Error` from a handler to fail the RPC call.

```ts
import { pluginOs } from "@get-halo/plugin-sdk/server";

const plugin = pluginOs;

export default {
  ping: plugin.handler(async ({ context }) => ({
    pluginId: context.pluginId,
  })),
  read: plugin.handler(({ context }) =>
    context.tools.files.read({ path: "notes.md" }),
  ),
};
```

You can also export a named `router` or `Server` object. Do not export a class or function.

In the view:

```ts
const server = usePluginServer<typeof router>();
await server.ping();
```

## Storage

This is the only persistence API. Do not use `localStorage`, `sessionStorage`, cookies, or files you invent.

Add `storage.ts` with Tandem collections. Spread `syncRoutes(tables)` into the server. Wrap `PluginStorageProvider` around `Routes`, and around `Sidebar` if the sidebar queries. Use `usePluginServer` for other RPC.

A complete todo plugin lives at `.halo/plugins/todos`. `halo.name` is `Todos`. `Sidebar` has a `SidebarItem` named `List`. `Routes` wraps `PluginStorageProvider` with `tables={todoTables}`, lists todos, and adds items with a field labeled `New todo` and a button named `Add`.

`storage.ts`:

```ts
import { collection, defineSchema, t } from "@get-halo/plugin-sdk/storage";

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
import { syncRoutes } from "@get-halo/plugin-sdk/server";
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
  },
  "devDependencies": {
    "@get-halo/plugin-sdk": "0.1.20"
  }
}
```

`view.tsx`:

```tsx
import {
  Button,
  Checkbox,
  Flex,
  H1,
  Padding,
  PluginStorageProvider,
  Route,
  SidebarItem,
  SidebarSection,
  Switch,
  TextField,
  proseMaxWidth,
  usePluginQuery,
  usePluginTransaction,
  useState,
} from "@get-halo/plugin-sdk/view";
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

type Todo = { id: string; title: string; done: boolean };

function Home() {
  const todos = usePluginQuery<Todo>({ collection: "todos" }, []);
  const addTodo = usePluginTransaction((tx, title: string) => {
    tx.set("todos", { id: crypto.randomUUID(), title, done: false });
  });
  const toggleTodo = usePluginTransaction((tx, todo: Todo) => {
    tx.set("todos", { ...todo, done: !todo.done });
  });
  const [title, setTitle] = useState("");

  function add() {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    addTodo(trimmed);
    setTitle("");
  }

  return (
    <Padding xy={6}>
      <Flex
        column
        gap={4}
        style={{ width: "100%", maxWidth: proseMaxWidth, marginInline: "auto" }}
      >
        <H1>Todos</H1>
        <Flex row gap={2}>
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
    </Padding>
  );
}
```
