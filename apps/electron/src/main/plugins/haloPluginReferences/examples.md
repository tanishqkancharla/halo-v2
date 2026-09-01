# Plugin examples

## Basic view and server

The default `halo plugin new <id>` scaffold is the current minimal example. It shows relative sidebar navigation, a main route, and a typed server handler. Keep its imports and hook exports when adding features.

## Persistent stored list

Run `halo plugin new <id> --storage` for a complete stored-list plugin. The scaffold includes:

- a typed `items` collection in `storage.ts`
- `syncRoutes(tables)` in `server.ts`
- `PluginStorageProvider` around `Routes`
- working query, insert, and update calls
- Maui text, button, checkbox, and layout components

Treat that scaffold as executable reference code. Adapt its record names and UI instead of guessing alternate collection, transaction, or Maui APIs.

## Host integration

A plugin that calls a host tool adds the exact path to `halo.capabilities`, then calls the same path through `context.tools` in a server handler:

```ts
import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  run: pluginOs.handler(async ({ context }) => {
    const result = await context.tools.example.operation({ value: "input" });
    if (!result.ok) return new Error(result.error.message);
    return result.data;
  }),
};
```

The path and input above are placeholders. Discover the connected operation and inspect its schema before writing the real call.
