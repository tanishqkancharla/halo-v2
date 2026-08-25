---
name: maui
description: Conventions and design constraints for consuming the Maui design system. Use when building UI with Maui tokens, components, or purse-styles in an app that depends on Maui.
---

# Maui

TypeScript-first design system styled with `purse-styles`. Wrap the app in `MauiProvider`, then import tokens and components from `"maui"`.

```ts
import { style } from "purse-styles"
import {
	MauiProvider,
	background,
	border,
	colors,
	radius,
	shadow,
} from "maui"

function App() {
	return (
		<MauiProvider>
			{/* … */}
		</MauiProvider>
	)
}
```

The published package exposes:

- `"maui"` — built barrel (`dist/`) of provider, theme, tokens, and components
- `"maui/icons"` — tree-shakeable named icon modules (same names as `Icons.*`)
- `"maui/src"` — TypeScript source barrel
- `"maui/src/*"` — TypeScript source for deep imports
- `"maui/skills/maui"` — this skill file

`MauiProvider` sets up theme (`data-theme` / `color-scheme`), `PurseProvider`, design-system globals, and the focus UI database used by Button/Dialog.

## Design constraints

- Hover backgrounds have no transitions. Hover fills (`backgroundColor.elementHover`, quiet-button washes, list/row highlights) snap instantly. Do not animate `background` / `background-color` on hover with `motion.standard(...)` or a CSS `transition`. Other motion (tooltips, transforms) is fine.
- Start from the closest existing pattern or app. Before inventing layout or chrome, look at `src/patterns/` and `src/apps/` that are closest to the end goal and reuse those structures.

## Theme FOUC

Put the exported `themeFoucScript` string in a classic inline `<script>` in `<head>` (before React boots) so `data-theme` is correct on first paint. The gallery `src/index.html` uses the same script.

Use `useTheme()` for preference / resolved theme. Token dark values use the `DARK_THEME` selector (`:root[data-theme="dark"]`). Prefer semantic tokens (`colors`, `background`, `avatar`, `focusRing()`) over bespoke CSS variables.

## Shadows

Use the three-level elevation scale:

- `shadow.subtle` — controls, cards, and ordinary raised surfaces
- `shadow.medium` — tooltips and larger floating panels
- `shadow.strong` — dropdowns, popovers, and dominant overlays

All three already include a 1px ring. Do not also apply `border()`, `borderColor.outline`, or another ring on the same element.

Buttons and form-control surfaces use `shadow.subtle` by default. For compound
controls, apply it once to the outer control boundary rather than to every
internal button or segment.

## Focus

`focusRing()` applies a theme-aware Radix blue shadow (`blueAlpha[8]` hard edge + `blueAlpha[5]` glow). Do not hand-roll a competing outline or box-shadow for keyboard focus.

## Layout utilities

`Flex`, `Padding`, and `Gap` take spacing scale steps (`1 | 2 | 3 | 4 | 6 | 8 | 12 | 16`), not raw pixels. Example: `<Flex row gap={4}>` is 9px, not 4px. `Spacer` grows to fill leftover flex space. `Divider` is a horizontal rule.

## Icons

Import named icons so unused SVGs are tree-shaken. Do not import the `Icons` namespace in app code unless you want the full set.

```ts
import { Search, Plus } from "maui"
import { Text as TextIcon } from "maui/icons"

<Search size="sm" />
<TextIcon size="md" />
```

`size` uses the same t-shirt scale as `text(...)` (`2xs`–`xl`, default `sm`). Stroke and fill use `currentColor`. Icons that share a root export name (`Text`, `Badge`, `Switch`, …) are `TextIcon` / `BadgeIcon` / `SwitchIcon` from `"maui"`, or the original name from `"maui/icons"` / `Icons.Text`.

## Components

### Typography and reading

- `Text` — size / weight / color / `monospace` span
- `H1`–`H4`, `P`, `Label`, `Blockquote`, `Ul`, `Ol`, `Li`, `Link`
- `Prose` — long-form rhythm; headings switch to the prose scale inside it
- `Editor` — TipTap markdown surface (CommonMark shortcuts, `proseHtml` type) with no chrome; wrap it for padding, elevation, and actions

### Form controls

- `Button` — `variant` is `"default"` | `"quiet"` | `"primary"`; `variantColor` is a palette name. Primary fills step 9 (hover 10) with light text (`onAccent`, or step 12 on amber/lime/mint/sky/yellow); quiet + color uses a 3.5% wash of step 9 (hover 7%).
- `TextField`, `SearchField`, `NumberField`, `QuietTextField`
- `Checkbox`, `Switch`, `Slider`
- `RadioOptionGroup` / `RadioOption`
- `Select` / `SelectItem`

### Collections and overlays

- `ListBox` / `ListBoxItem`
- `MenuTrigger` / `Menu` / `MenuItem`
- `Tooltip`
- `CollectionPopover` — shared popover used by Select and Menu
- `Overlay`, `Dialog`

### Display

- `Avatar`
- `Badge`
- `Code`, `Kbd`, `CodeBlock`
- `Table` / `TableHead` / `TableBody` / `TableRow` / `TableHeaderCell` / `TableCell`
- `Panel` — gallery/demo surface
- `FuzzyString` — highlight segments; takes a match result, not a plain string
- `Thinking` — 3×3 Game of Life indicator; reseeds when the board dies or loops

## Reference: patterns and apps

Patterns and demo apps are not part of the `"maui"` package barrel. Use the closest one as a reference before inventing new layout (also available via `"maui/src/..."` when the package ships source):

### Patterns — `src/patterns/`

| Path | Role |
| --- | --- |
| `src/patterns/AssistantMessage.tsx` | Streaming markdown reply (Streamdown + Maui prose) |
| `src/patterns/Sidebar.tsx` | App sidebar chrome |
| `src/patterns/Inbox.tsx` | Mail inbox layout |
| `src/patterns/MessageList.tsx` | Message list rows |

### Apps — `src/apps/`

| Path | Role |
| --- | --- |
| `src/apps/AiChat/` | Mock streaming AI chat (Editor + AssistantMessage) |
| `src/apps/EmailClient/` | Email client demo composing inbox patterns |
| `src/apps/Calendar/` | Three-pane schedule (mini month, week grid, event details) |
| `src/apps/JsxEditor/` | Live JSX playground (CodeMirror + Maui catalog) |

## License

Maui is source-available under the PolyForm Noncommercial License 1.0.0. Do not use it in commercial products except software Tanishq Kancharla personally creates, or another project the copyright holder grants in `NOTICE` or in writing.
