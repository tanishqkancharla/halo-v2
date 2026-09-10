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

The server also stops after 24 hours without a page or file-excerpt request.
Loading or refreshing the page resets the timer; background health checks and
Vite connections do not keep it alive.

List every running viewer, including viewers using custom ports:

```sh
npx tkstack list
```

Request the page with `Accept: text/markdown` to read the current source file
instead of the rendered HTML:

```sh
curl -H 'Accept: text/markdown' http://127.0.0.1:4177/
```

## Library

```ts
import { startServer, parseFence, parseViewerDocument } from "tkstack";
```

`parseViewerDocument` turns markdown into the page document with [md4x](https://github.com/unjs/md4x). `startServer` listens. Halo skills own spec vs walkthrough section order; tkstack does not.

## Fences

| Fence info string                              | Viewer                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mermaid`                                      | Beautiful Mermaid                                                                                 |
| `callstack` or `diff` containing `└──` / `├──` | Interactive stack rows, no file header                                                            |
| `diff` or `diff:path` with a file path         | Pierre patch with Pierre’s file header                                                            |
| `diff` with no path                            | Pierre patch, no file header                                                                      |
| `start:end:path`                               | Pierre file excerpt with Pierre’s file header                                                     |
| `html`                                         | Trusted HTML from this file. tkstack does not sanitize it. Only use it for local files you wrote. |
| other langs                                    | Maui `CodeBlock`                                                                                  |

Fences keep whitespace. Use them for mermaid, call stacks, and diffs.

## MDC

md4x Comark components map to the same views:

```md
::mermaid
flowchart TD
A --> B
::

::callstack
startServer
+└── createViteServer
::

::diff{path="src/cli.ts"}
--- a/src/cli.ts
+++ b/src/cli.ts
::

::file{path="src/cli.ts" start="1" end="20"}
::

::html
<aside>Note.</aside>
::
```

`.md` and `.mdx` are both markdown. Curly braces in prose are plain text.

## Link call stacks to source changes

Append `[[id:side:start-end]]` to a call stack line. `side` is `old` or `new`;
line numbers refer to that version of the source file, not the patch. A single
line can use `[[id:new:12]]`. Multiple references on one stack line are allowed.
The references are hidden in the rendered stack, and linked rows support mouse
clicks and keyboard activation.

Define each ID once in a `source-diff:id:path` fence anywhere in the document.
Copy the file's actual Git patch, including its `diff --git`, file headers, and
`@@` hunk headers. Keep enough context to explain the change. Each reference
range must fit within one included hunk. Use the new path for renamed files and
the old path for deleted files.

````md
```callstack
 handleRequest
-└── saveUnchecked [[request:old:12]]
+├── validateInput # reject invalid input [[request:new:12-13]]
 └── saveRecord
```

```source-diff:request:src/request.ts
diff --git a/src/request.ts b/src/request.ts
--- a/src/request.ts
+++ b/src/request.ts
@@ -10,5 +10,6 @@
 export function handleRequest(input: Input) {
   const record = input.record;
-  saveUnchecked(record);
+  const error = validateInput(record);
+  if (error instanceof Error) return error;
   return saveRecord(record);
 }
```
````

Source definitions appear in one shared panel beside the walkthrough. Selecting
a stack line highlights it and scrolls the panel to the linked code range. When
a line has several references, buttons above the source viewer select among
them. On narrow windows the source panel sits below the walkthrough. Documents
without source definitions keep the single-panel layout.

Unknown IDs, duplicate definitions, malformed references, mismatched paths, and
ranges outside the included hunks produce a parse error. Source patches are
embedded snapshots; the viewer does not regenerate them from the working tree.

Cmd-click (or Ctrl-click) a TypeScript or JavaScript symbol in the source panel
to open its definition. Use Back to retrace navigation and return to the diff.
Resolution uses the workspace's TypeScript configuration and current files.
Deleted files and lines that no longer match the workspace show a message;
their call stack references still highlight the embedded old-side diff.

Run `pnpm exec tkstack packages/tkstack/fixtures/annotations.md` for an example
with old/new references, multiple files, and unchanged context.
