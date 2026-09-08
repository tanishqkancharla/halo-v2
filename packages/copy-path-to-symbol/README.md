# Copy Path to Symbol

Place the cursor inside a symbol, then run **Copy Path to Symbol** from the Command Palette or editor context menu.

The extension copies a workspace-relative reference such as:

```text
packages/server/src/extensions/ExtensionHost.ts#ExtensionHost.list
```

When text is selected, the command becomes **Copy Path to Range** and copies the selected lines instead:

```text
packages/server/src/extensions/ExtensionHost.ts:12-18
```

A selection within one line copies `path:12`. Line numbers are one-based; a selection ending at the start of a line excludes that line. Range copying also works in files without symbols.
