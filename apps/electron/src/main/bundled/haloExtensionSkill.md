---
name: halo-extension
description: Create or edit Halo UI extensions — sidebar sections and main views — in the workspace `.halo/extensions` folder. Use when the user wants a new page, sidebar item, calendar, notes view, or other in-app UI.
---

# Halo extensions

Halo loads UI from `{workspace}/.halo/extensions/<id>/index.tsx`. Edit those files to add or change sidebar entries and views. Halo compiles the file, injects the app's React and Maui, and hot-reloads on save.

## When to use

The user wants a new view or sidebar item in Halo, or wants to change an extension that already exists (including the seeded Calendar).

## Layout

```text
{workspace}/.halo/extensions/<id>/index.tsx
```

`<id>` is the folder name (for example `calendar`, `notes`). One folder, one extension.

Do not put Halo UI under `.pi/extensions/` — that path is for Pi agent plugins, not the desktop shell.

## File shape

Default-export an object:

```tsx
import { useState } from "react";
import { Button, H2, P, backgroundColor, flex, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";

function ExampleView() {
  const pane = useStyles(styles.pane);
  return (
    <main className={pane} aria-label="Example">
      <H2>Example</H2>
      <P>Loaded from a workspace extension.</P>
    </main>
  );
}

const styles = {
  pane: style(
    flex({ direction: "column", gap: 4 }),
    spacing.padding({ all: 12 }),
    {
      minWidth: 0,
      minHeight: 0,
      height: "100%",
      backgroundColor: backgroundColor.app,
    },
  ),
};

export default {
  sidebarEntries: [
    {
      id: "example",
      label: "Example",
      items: [{ id: "example.main", label: "Main", viewId: "main" }],
    },
  ],
  views: {
    main: ExampleView,
  },
};
```

- `sidebarEntries` — sections appended below Sessions. Each item's `viewId` must match a key in `views`.
- `views` — React function components. They render in the main pane, already inside `MauiProvider`.

See `{workspace}/.halo/extensions/calendar/index.tsx` for a working month view.

## Modules Halo provides

Import only these. Do not run `pnpm install` or add a `package.json` for the extension. Halo resolves them at load time:

- `react`
- `react/jsx-runtime`
- `maui`
- `purse-styles`

Do not import `react-dom`, Node builtins, Electron, or Halo app files. There is no `fs` in the renderer.

## UI rules

- Use Maui components (`Button`, `H2`, `P`, `TextField`, `Flex`) and tokens (`colors`, `spacing`, `text`, `flex`, `backgroundColor`).
- Style with `style` / `useStyles` from `purse-styles`, same as the rest of Halo.
- Put `aria-label` on the view's `<main>`.
- Prefer `undefined` for missing values, not `null`.
- The shell already wraps the app in `MauiProvider`. Do not add another provider.

## Reload

Save the file. Halo watches `.halo/extensions` and rebuilds that extension. If compile fails, the error appears in the sidebar and the previous views for other extensions stay up.

## State

Use React state for in-memory UI. For durable data, write files next to the extension (for example `data.json`) with Pi's file tools, then read them on demand. There is no extension database API yet.

## Modify an existing extension

Open its `index.tsx` and change `sidebarEntries` or `views`. Do not copy the file into the Halo repo. The workspace copy is the source of truth. Halo seeds Calendar and this skill only when those paths are missing, so user edits stick.
