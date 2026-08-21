# tkstack

Serve a spec or code walkthrough as a local page.

```sh
pnpm exec tkstack path/to/file.md
```

Halo aliases: `pnpm spec` and `pnpm walkthrough`. After publish: `npx tkstack path/to/file.md`.

Options:

- `--port <n>` — listen port (default `4177`)
- `--root <dir>` — workspace root for file excerpts (default the directory you ran the command from)

**Done** in the top right stops the server.

## Library

```ts
import { startServer, parseFence, compileViewerSource } from "tkstack";
```

`compileViewerSource` turns markdown or MDX into the page module. `startServer` listens. Halo skills own spec vs walkthrough section order; tkstack does not.

## Fences

| Fence info string                              | Viewer                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mermaid`                                      | Beautiful Mermaid                                                                                 |
| `callstack` or `diff` containing `└──` / `├──` | Pierre patch, no file header                                                                      |
| `diff` or `diff:path` with a file path         | Pierre patch with Pierre’s file header                                                            |
| `diff` with no path                            | Pierre patch, no file header                                                                      |
| `start:end:path`                               | Pierre file excerpt with Pierre’s file header                                                     |
| `html`                                         | Trusted HTML from this file. tkstack does not sanitize it. Only use it for local files you wrote. |
| other langs                                    | Maui `CodeBlock`                                                                                  |

`.md` compiles as markdown. `.mdx` compiles as MDX.
