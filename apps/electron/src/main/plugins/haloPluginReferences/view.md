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

Use Maui for controls and layout, purse-styles for styles, and wouter for routes. Halo already supplies their providers and runtime packages. Do not use raw HTML controls. Halo provides the `maui` skill from its runtime package; use it from the available skill list before choosing component props or tokens. Do not look for it under the workspace's `.pi/agent/skills/` directory.

After scaffolding, the same Maui skill and its source examples are available under `node_modules/maui/skills/maui/SKILL.md` and `node_modules/maui/src/`. Read the closest app or pattern before inventing a layout.

`halo plugin build` writes `dist/view.js`. Halo supplies React, Maui, purse-styles, wouter, and the Halo SDK at runtime. The build bundles other plugin dependencies.

Exports from `@get-halo/plugin-sdk/view`:

- `SidebarSection`, `SidebarItem`
- `useSidebarNavigation`
- `usePluginServer`
- `PluginStorageProvider`, `usePluginQuery`, `usePluginEntity`, `usePluginTransaction`

Read the installed `view.d.ts` for current signatures.
