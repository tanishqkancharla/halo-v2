# Server reference

`server.ts` exports an oRPC router as its default export. Object keys become procedure names; nested objects become dotted paths. Views call them through `usePluginServer`, and the CLI calls non-streaming procedures with `halo plugin <id> <path>`.

Use `pluginOs` from `@get-halo/plugin-sdk/server`. Each handler receives:

- `context.pluginId`
- `context.workspaceRoot`
- `context.tools`, the plugin's granted host-tool facade

Procedures are request handlers, not startup or reload hooks. Halo runs one only when a caller invokes it. Builds remount server modules without keeping the old module cache.

```ts
import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  status: pluginOs.handler(async ({ context }) => ({
    pluginId: context.pluginId,
  })),
};
```

A handler may return an async iterable for renderer streaming. The CLI only supports non-streaming results.

Return an `Error` to fail an RPC call. When calling `context.tools`, handle both result shapes:

- `{ ok: true, data, http? }`
- `{ ok: false, error: { code, message, status?, details?, retryable? } }`

Host tools accept JSON-like input. Use exact connected paths and request those same paths in `halo.capabilities`. Read the installed `server.d.ts` for current exports and handler types.
