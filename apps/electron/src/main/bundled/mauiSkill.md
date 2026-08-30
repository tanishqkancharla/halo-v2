---
name: maui
description: >
  Required for every Halo plugin view. Use Maui components, tokens, Flex
  spacing, and purse-styles whenever you create or edit plugin UI.
---

# Maui in Halo plugins

Halo already wraps the app in `MauiProvider` and paints the plugin pane with `backgroundColor.app`. Import every UI name from `@get-halo/plugin-sdk/view`. Do not import from `"maui"` or `"purse-styles"`. Do not wrap `MauiProvider`.

Do not use raw `<button>`, `<input>`, `<textarea>`, `<select>`, or a native checkbox.

## Design approach

Start from the closest Maui pattern or app before inventing layout or chrome. Reuse its structure and density, then adapt it to real data. Do not default to a generic dashboard of stat cards, pill clouds, oversized headings, or a separate raised card for every section.

Closest references:

- Calendar or schedule: `references/apps/Calendar/Calendar.tsx` — compact toolbar, integrated all-day row and time grid, small-radius tinted events
- Mail or work queues: `references/patterns/Inbox.tsx` and `references/patterns/MessageList.tsx` — dense rows with quiet secondary text
- Chat: `references/apps/AiChat/` and `references/patterns/AssistantMessage.tsx`
- Dense editors: `references/apps/JsxEditor/` — full-pane tool layout

Read the closest reference source before writing the view. Resolve these paths relative to this `SKILL.md`.

Reserve full pane width for dense tools such as calendars, tables, kanban, and side-by-side editors. Ordinary reading, settings, and form pages use the centered `proseMaxWidth` pattern below.

## Page width

The pane is the full main column. Do not stretch a simple page across it.

For a list, form, notes, or settings screen, wrap content in a centered column at `proseMaxWidth` (`72ch`) with `Padding xy={6}`:

```tsx
import { Flex, Padding, proseMaxWidth } from "@get-halo/plugin-sdk/view";

<Padding xy={6}>
  <Flex
    column
    gap={4}
    style={{ width: "100%", maxWidth: proseMaxWidth, marginInline: "auto" }}
  >
    {/* page */}
  </Flex>
</Padding>;
```

Full pane width should be reserved for when you need it (horizontally dense tools, like tables, a CRM, kanban, or side-by-side panes).

Do not set a page-level gray background. The host already uses `backgroundColor.app`.

## Components

### Layout

- `Flex` — row or column. `gap` is a spacing step (`1 | 2 | 3 | 4 | 6 | 8 | 12 | 16`), not pixels. `<Flex row gap={4}>` is a scale step, not 4px.
- `Padding` — `xy`, `x`, `y`, `top`, `left`, `right`, `bottom` are spacing steps.
- `Gap` — fixed spacer (`width` or `height` as a spacing step).
- `Spacer` — flex grow.
- `Divider` — rule.
- `Panel` — demo/surface card. Skip for ordinary pages.
- `Overlay` — portal + click-outside.

Prefer `Flex` over `style({ display: "flex" })`.

### Typography

- `H1` `H2` `H3` `H4` `P` `Label` `Blockquote` `Ul` `Ol` `Li`
- `Prose` — long-form type scale and rhythm. `proseMaxWidth` is `72ch`.
- `CodeBlock` — fenced code.

### Controls

- `Button` — actions. `variant="quiet"` for secondary actions and `variant="primary"` for the main action. Buttons already include their control surface and focus treatment.
- `TextField` — text. `value`, `onChange(value)`, `aria-label` or `label`.
- `QuietTextField` — borderless text.
- `SearchField` `NumberField`
- `Checkbox` — `label`, `checked`, `setChecked(checked)`.
- `Select` + `SelectItem`
- `RadioOptionGroup` + `RadioOption`
- `Slider`

### Overlays and menus

- `Dialog` — modal. Pair with `Overlay` if you need a backdrop.
- `Tooltip`
- `MenuTrigger` `Menu` `MenuItem`
- `ListBox` `ListBoxItem`
- `CollectionPopover` — menu/select popover chrome.

### Data and chrome

- `Table` `TableHead` `TableBody` `TableRow` `TableHeaderCell` `TableCell`
- `Avatar` `Badge` `Icons`
- `FuzzyString` — highlighted fuzzy match.

Plugin routing uses wouter's `Link`, `Route`, and `Switch` from `@get-halo/plugin-sdk/view`, not Maui's.

```tsx
import {
  Button,
  Checkbox,
  Flex,
  H1,
  Padding,
  TextField,
  proseMaxWidth,
} from "@get-halo/plugin-sdk/view";

<Padding xy={6}>
  <Flex
    column
    gap={4}
    style={{ width: "100%", maxWidth: proseMaxWidth, marginInline: "auto" }}
  >
    <H1>Todos</H1>
    <Flex row gap={2}>
      <TextField aria-label="New todo" value={title} onChange={setTitle} />
      <Button onClick={add}>Add</Button>
    </Flex>
    <Checkbox
      label={todo.title}
      checked={todo.done}
      setChecked={() => toggle(todo)}
    />
  </Flex>
</Padding>;
```

## Tokens

If you need `style()`, import `style` and tokens from `@get-halo/plugin-sdk/view`. Use `colors`, `background`, `backgroundColor`, `shadow`, `radius`, and `spacing`. Do not use raw `rgba(...)`, hex colors, or pixel padding.

Use tokens directly; do not enumerate them or add a `getTokenValue` helper. Compose class names with `style()` and `useStyles()`:

```tsx
const card = style(radius.sm, shadow.subtle, {
  backgroundColor: backgroundColor.element,
});

<div className={useStyles(card)} />;
```

- `backgroundColor.app` — page
- `backgroundColor.element` — raised control/surface
- `shadow.subtle` — cards and controls
- `shadow.medium` — tooltips
- `shadow.strong` — dropdowns

Shadows already include a 1px ring. Do not also apply `border()`.

`focusRing()` is the keyboard focus style. Do not hand-roll an outline.

Hover fills snap immediately. Do not animate `background` or `background-color` on hover.

Use `shadow.subtle` once on an ordinary raised surface or compound control. Use `shadow.medium` for tooltips and `shadow.strong` for popovers. Do not put shadows on every row or event in a dense schedule.

Token source: [maui/src/tokens](https://github.com/tanishqkancharla/maui/tree/main/src/tokens).

## Custom CSS

Use `style` and `useStyles` when Maui components cannot express the layout. Keep custom CSS structural and token-based.
