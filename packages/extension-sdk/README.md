# Extension SDK prototype

Runtime libraries shared by standalone Halo extensions:

- `/api`: oRPC procedure builders and TypeBox schemas for `api.ts`.
- `/schema`: Tandem schema builders for `schema.ts`.
- `/view`: typed `ExtensionViewProps` and the `useQuery` React hook.
- `/client`: browser API and Tandem connection setup.
- `/server`: the standalone HTTP server and command-line startup.

`view.tsx` receives `{ api, storage }`. `api` calls the extension's router at
`/api/`; `storage` is its Tandem client, connected through `/sync/`. Pass a stable
query object to `useQuery(storage, query)` and use Tandem transactions for edits.
Each browser owns its client and local navigation; the server owns persistent
shared data. The SDK does not import Halo or require Electron.

The generated application bundles the SDK and its dependencies. React and
ReactDOM are normal peer dependencies within each extension's dependency tree;
they are not injected from Halo or shared as live objects across extensions.

Scaffolding and esbuild configuration live in the separate development package,
[`@get-halo/extension-tools`](../extension-tools/README.md). Both packages use the
repository's TypeScript version to emit their runtime JavaScript and declarations.
