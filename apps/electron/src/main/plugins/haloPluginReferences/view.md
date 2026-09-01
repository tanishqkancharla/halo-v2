# View reference

The view is one browser bundle with two independent React mounts:

- `Sidebar` mounts in Halo's left sidebar. Use `SidebarSection` and `SidebarItem` for navigation or small status UI. An active item supplies Halo's shared page title.
- `Routes` mounts in the main pane at `/plugins/<id>`, below Halo's shared header. Links and routes are relative to that plugin base.

Export either hook or both. State and custom React context do not cross between them. If both hooks use plugin storage, wrap each one in its own `PluginStorageProvider`.

Halo wraps both hooks in `PluginServerProvider`. Call the server with `usePluginServer<typeof router>()` and import its router as a type:

```tsx
import { usePluginServer } from "@get-halo/plugin-sdk/view";
import type router from "./server.js";

const server = usePluginServer<typeof router>();
const result = await server.status();
```

Use Maui for controls and layout, purse-styles for styles, and wouter for routes. Halo already supplies their providers and runtime packages. Do not use raw HTML controls. Read the `maui` skill and its source references before choosing component props or tokens.

`halo plugin build` writes `dist/view.js`. Halo supplies React, Maui, purse-styles, wouter, and the Halo SDK at runtime. The build bundles other plugin dependencies.

Exports from `@get-halo/plugin-sdk/view`:

- `SidebarSection`, `SidebarItem`
- `useSidebarNavigation`
- `usePluginServer`
- `PluginStorageProvider`, `usePluginQuery`, `usePluginEntity`, `usePluginTransaction`

Read the installed `view.d.ts` for current signatures.
