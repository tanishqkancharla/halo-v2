# Extension tools prototype

Shared development tooling for standalone Halo extensions. An extension installs
`@get-halo/extension-sdk` as a dependency and `@get-halo/extension-tools` as a
dev dependency. Build configuration lives here; the runtime SDK does not depend
on esbuild.

An extension contains three source files:

- `view.tsx`: the default-exported React app, served under `/view/`. Nested URLs
  load the same app, which owns its frontend routing.
- `api.ts`: the default-exported oRPC router, mounted directly under `/api/`.
- `schema.ts`: the default-exported Tandem schema. The SDK owns `/sync/`.

```ts
import { scaffoldExtension } from "@get-halo/extension-tools/scaffold";

const result = await scaffoldExtension({
  directory: "/absolute/path/to/my-extension",
  name: "my-extension",
});
if (result instanceof Error) throw result;
```

The equivalent CLI is `halo-extension scaffold my-extension`. Scaffolding
creates a new directory and writes the source, package scripts, dependencies,
TypeScript configuration, and gitignore. Installation is explicit:

```sh
cd my-extension
npm install
npm run typecheck
npm run build
npm start -- --port 3000 --data-dir .extension-data
```

These prototype packages are not published. For local development, the scaffold
API accepts `packages: { sdk: "file:/path/to/sdk.tgz", tools: "file:/path/to/tools.tgz" }`.
The end-to-end tests pack both packages and use this ordinary npm installation path.

One build compiles the frontend and Node server, including their imported schema
code and real dependencies. Both outputs must succeed before `dist/current.json`
selects the new build. `node dist/start.mjs` starts that complete build without
loading the development tools. Existing processes continue using their original
build. Successful build generations are retained; pruning is not implemented.

The server listens on loopback and serves `/view/`, `/api/`, and `/sync/`.
Data is persisted to `<data-dir>/store.json` using Tandem's `JsonFileRemote`.
This prototype has no Halo hosting, authentication, or workspace integrations.
JSON persistence is a prototype default, not the final database design.

## Verification

```sh
pnpm --filter @get-halo/extension-tools test
```

`test/fixtures/tasks/` holds the reusable Tasks source as ordinary TypeScript and TSX files. `await loadExtension(sourceDirectory)` is supplied by the fixture. It scaffolds a
package through the public API, writes that source, installs the packed packages,
typechecks, builds, and runs an actual Node server. Playwright tests cover the
starter, nested view URLs and API calls, collaboration between independent
browser contexts, and persistence after restart. No Electron or Halo server runs.
