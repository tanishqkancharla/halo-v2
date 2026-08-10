---
name: maui
description: Conventions for consuming the Maui design system. Use when building UI with Maui tokens, components, or purse-styles in an app that depends on Maui.
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
- `"maui/src/*"` — TypeScript source for deep imports
- `"maui/skills/maui"` — this skill file

`MauiProvider` sets up theme (`data-theme` / `color-scheme`), `PurseProvider`, design-system globals, and the focus UI database used by Button/Dialog.

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

`Flex`, `Padding`, and `Gap` take spacing scale steps (`1 | 2 | 3 | 4 | 6 | 8 | 12 | 16`), not raw pixels. Example: `<Flex row gap={4}>` is 9px, not 4px.

## Reference: patterns and apps

Patterns and demo apps are **not** part of the `"maui"` package barrel. Use them as in-repo reference implementations (also available via `"maui/src/..."` when the package ships source):

### Patterns — `src/patterns/`

| Path | Role |
| --- | --- |
| `src/patterns/AssistantMessage.tsx` | Streaming markdown reply (Streamdown + Maui prose) |
| `src/patterns/Editor.tsx` | TipTap markdown composer |
| `src/patterns/Loader.tsx` | Game-of-life loader |
| `src/patterns/Sidebar.tsx` | App sidebar chrome |
| `src/patterns/Tree.tsx` | Nested tree navigation |
| `src/patterns/Inbox.tsx` | Mail inbox layout |
| `src/patterns/MessageList.tsx` | Message list rows |

### Apps — `src/apps/`

| Path | Role |
| --- | --- |
| `src/apps/AiChat/` | Mock streaming AI chat (Editor + AssistantMessage) |
| `src/apps/EmailClient/` | Email client demo composing inbox patterns |
