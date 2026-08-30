import React$1 from 'react';
import { AnchorHTMLAttributes, FunctionComponent, JSXElementConstructor, MouseEventHandler, ReactElement, ReactNode, RefAttributes, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Root provider for consuming Maui. Wraps theme (`data-theme`), purse-styles,
 * design-system globals, and the focus UI database used by Button/Dialog.
 *
 * Pair with {@link themeFoucScript} in `<head>` to avoid a flash of wrong theme.
 */
export declare function MauiProvider(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;
export type ThemeContextValue = {
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
	setPreference: (preference: ThemePreference) => void;
};
export declare const themeStorageKey = "maui-theme";
export declare function useTheme(): ThemeContextValue;
/**
 * Inline this in `<head>` before first paint so `data-theme` is set before
 * CSS vars resolve. Keep in sync with the gallery `index.html` FOUC script.
 */
export declare const themeFoucScript: string;
/** Selector condition for `defineVars` dark theme values. */
export declare const DARK_THEME: ":root[data-theme=\"dark\"]";
export type BaseCSSProperties = CSS.Properties<number | string, string & {}>;
export type CustomProperties = {
	[name: `--${string}`]: string | number | undefined;
};
export type Declarations = BaseCSSProperties & CustomProperties;
export type NestedRuleKey = `&${CSS.SimplePseudos}` | `${CSS.AtRules}${string}` | `.${string}` | `&${string}`;
export type CSSProperties = {
	[Key in keyof BaseCSSProperties]?: BaseCSSProperties[Key];
} & CustomProperties & {
	[Key in NestedRuleKey]?: Declarations;
};
declare const __style__: unique symbol;
export type StyleRule = string;
export type StyleElement = {
	__style__: typeof __style__;
	composed: StyleElement[];
	owned?: {
		styleRules: StyleRule[];
		className: string;
	};
	className: string;
};
export type StyleArgument = CSSProperties | StyleElement | false | null | undefined;
export declare function style(...styleElementsOrCSS: StyleArgument[]): StyleElement;
export declare function useStyles(...styleElementsOrCSS: StyleArgument[]): string;
export type CSSVar = `var(--${string})`;
export type VariableGroup<T extends Record<string, unknown>> = {
	readonly [K in keyof T]: CSSVar;
};
declare const STEPS: readonly [
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	12
];
export type ColorScaleStep = (typeof STEPS)[number];
export type ColorScale = {
	readonly [K in ColorScaleStep]: string;
};
export declare const paletteNames: readonly [
	"gray",
	"mauve",
	"slate",
	"sage",
	"olive",
	"sand",
	"tomato",
	"red",
	"ruby",
	"crimson",
	"pink",
	"plum",
	"purple",
	"violet",
	"iris",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"jade",
	"green",
	"grass",
	"bronze",
	"gold",
	"brown",
	"orange",
	"amber",
	"yellow",
	"lime",
	"mint",
	"sky"
];
export declare const colorNames: readonly [
	"accent",
	"gray",
	"mauve",
	"slate",
	"sage",
	"olive",
	"sand",
	"tomato",
	"red",
	"ruby",
	"crimson",
	"pink",
	"plum",
	"purple",
	"violet",
	"iris",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"jade",
	"green",
	"grass",
	"bronze",
	"gold",
	"brown",
	"orange",
	"amber",
	"yellow",
	"lime",
	"mint",
	"sky"
];
export type ColorName = (typeof colorNames)[number];
export declare const colors: {
	grayAlpha: ColorScale;
	mauveAlpha: ColorScale;
	slateAlpha: ColorScale;
	sageAlpha: ColorScale;
	oliveAlpha: ColorScale;
	sandAlpha: ColorScale;
	tomatoAlpha: ColorScale;
	redAlpha: ColorScale;
	rubyAlpha: ColorScale;
	crimsonAlpha: ColorScale;
	pinkAlpha: ColorScale;
	plumAlpha: ColorScale;
	purpleAlpha: ColorScale;
	violetAlpha: ColorScale;
	irisAlpha: ColorScale;
	indigoAlpha: ColorScale;
	blueAlpha: ColorScale;
	cyanAlpha: ColorScale;
	tealAlpha: ColorScale;
	jadeAlpha: ColorScale;
	greenAlpha: ColorScale;
	grassAlpha: ColorScale;
	bronzeAlpha: ColorScale;
	goldAlpha: ColorScale;
	brownAlpha: ColorScale;
	orangeAlpha: ColorScale;
	amberAlpha: ColorScale;
	yellowAlpha: ColorScale;
	limeAlpha: ColorScale;
	mintAlpha: ColorScale;
	skyAlpha: ColorScale;
	gray: ColorScale;
	mauve: ColorScale;
	slate: ColorScale;
	sage: ColorScale;
	olive: ColorScale;
	sand: ColorScale;
	tomato: ColorScale;
	red: ColorScale;
	ruby: ColorScale;
	crimson: ColorScale;
	pink: ColorScale;
	plum: ColorScale;
	purple: ColorScale;
	violet: ColorScale;
	iris: ColorScale;
	indigo: ColorScale;
	blue: ColorScale;
	cyan: ColorScale;
	teal: ColorScale;
	jade: ColorScale;
	green: ColorScale;
	grass: ColorScale;
	bronze: ColorScale;
	gold: ColorScale;
	brown: ColorScale;
	orange: ColorScale;
	amber: ColorScale;
	yellow: ColorScale;
	lime: ColorScale;
	mint: ColorScale;
	sky: ColorScale;
	accent: VariableGroup<{
		readonly 1: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 2: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 3: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 4: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 5: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 6: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 7: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 8: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 9: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 10: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 11: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 12: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
	}>;
	accentAlpha: VariableGroup<{
		readonly 1: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 2: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 3: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 4: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 5: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 6: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 7: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 8: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 9: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 10: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 11: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
		readonly 12: {
			readonly default: string;
			readonly ":root[data-theme=\"dark\"]": string;
		};
	}>;
};
export declare const backgroundColor: {
	elementHover: `var(--${string})`;
	elementActive: `var(--${string})`;
	element: `var(--${string})`;
	app: `var(--${string})`;
};
export declare const background: {
	app: StyleElement;
	element: StyleElement;
	elementHover: StyleElement;
	elementActive: StyleElement;
	accent: StyleElement;
	accentHover: StyleElement;
};
export type BorderSide = "top" | "right" | "bottom" | "left";
export type BorderColor = "border" | "outline" | "accent";
export declare const borderColor: VariableGroup<{
	readonly border: `oklch(from ${string} l c h / 0.05)`;
	readonly outline: `oklch(from ${string} l c h / 0.1)`;
}>;
export declare const border: (sides: BorderSide[], color: BorderColor) => StyleElement;
export declare const radius: {
	readonly none: StyleElement;
	readonly "2xs": StyleElement;
	readonly xs: StyleElement;
	readonly sm: StyleElement;
	readonly md: StyleElement;
	readonly lg: StyleElement;
	readonly pill: StyleElement;
	readonly circle: StyleElement;
};
export declare const shadowVars: VariableGroup<{
	readonly subtle: `rgba(var(--${string}), 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, var(--${string})) 0px 1px 1px -0.5px, rgba(0, 0, 0, var(--${string})) 0px 3px 3px -1.5px`;
	readonly medium: `rgba(var(--${string}), 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, var(--${string})) 0px 1px 1px -0.5px, rgba(0, 0, 0, var(--${string})) 0px 3px 3px -1.5px, rgba(0, 0, 0, var(--${string})) 0px 6px 6px -3px`;
	readonly strong: `rgba(var(--${string}), 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, var(--${string})) 0px 1px 1px -0.5px, rgba(0, 0, 0, var(--${string})) 0px 3px 3px -1.5px, rgba(0, 0, 0, var(--${string})) 0px 6px 6px -3px, rgba(0, 0, 0, calc(var(--${string}) * 0.67)) 0px 12px 12px -6px, rgba(0, 0, 0, calc(var(--${string}) * 0.67)) 0px 24px 24px -12px`;
}>;
/** Same offsets as `shadowVars.subtle`, with the ring and blurs tinted from `color`. */
export declare function tintedSubtle(color: string): string;
export declare const shadow: {
	subtle: StyleElement;
	medium: StyleElement;
	strong: StyleElement;
};
/**
 * Blue focus ring — hard edge uses step 8, soft glow uses step 5.
 * Pass an existing box-shadow to retain the control's elevation while focused.
 */
export declare const focusRing: (selector?: string | undefined, existingShadow?: string | undefined) => StyleElement;
declare const spacingValues: {
	readonly 1: "2px";
	readonly 2: "4px";
	readonly 3: "6px";
	readonly 4: "9px";
	readonly 6: "12px";
	readonly 8: "16px";
	readonly 12: "24px";
	readonly 16: "32px";
};
export type Space = keyof typeof spacingValues;
export type PaddingOptions = {
	all?: Space;
	x?: Space;
	y?: Space;
	top?: Space;
	right?: Space;
	bottom?: Space;
	left?: Space;
};
export declare const spacing: {
	readonly gap: {
		readonly 1: StyleElement;
		readonly 2: StyleElement;
		readonly 3: StyleElement;
		readonly 4: StyleElement;
		readonly 6: StyleElement;
		readonly 8: StyleElement;
		readonly 12: StyleElement;
		readonly 16: StyleElement;
	};
	readonly padding: (options: PaddingOptions) => StyleElement;
	/**
	 * Raw pixel value for a scale step. Only meant for the rare case (like
	 * `Prose`'s vertical rhythm) where neither gap nor padding applies.
	 */
	readonly value: (step: Space) => "12px" | "16px" | "24px" | "2px" | "4px" | "6px" | "9px" | "32px";
};
type Space$1 = 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16;
export type Align = "start" | "center" | "end" | "stretch" | "baseline";
export type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";
export type FlexOptions = {
	direction?: "row" | "column";
	align?: Align;
	justify?: Justify;
	gap?: Space$1;
	wrap?: boolean;
};
export type FlexItemOptions = {
	size?: "hug" | "fill" | "auto";
	align?: Align;
	order?: number;
};
export type GridOptions = {
	columns?: "one" | "two" | "three" | "autoFit" | "sidebarContent";
	align?: Align;
	justify?: Justify;
	gap?: Space$1;
};
export type GridItemOptions = {
	area?: "sidebar" | "content";
	span?: "full" | 1 | 2 | 3;
	align?: Align;
	justify?: Align;
};
export declare const flex: (options?: FlexOptions | undefined) => StyleElement;
export declare const flexItem: (options?: FlexItemOptions | undefined) => StyleElement;
export declare const grid: (options?: GridOptions | undefined) => StyleElement;
export declare const gridItem: (options?: GridItemOptions | undefined) => StyleElement;
export type TextSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl";
export type TextWeight = 400 | 500 | 600 | 700;
export type TextColor = "lowContrast" | "highContrast" | "accent" | "onAccent";
export declare const fontFamily = "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Helvetica, \"Apple Color Emoji\", Arial, sans-serif, \"Segoe UI Emoji\", \"Segoe UI Symbol\"";
export declare const monoFontFamily = "\"Commit Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace";
export declare const baseTextStyle: {
	fontWeight: 400;
	color: string;
	filter?: import("csstype").Property.Filter | undefined;
	fill?: import("csstype").Property.Fill | undefined;
	accentColor?: import("csstype").Property.AccentColor | undefined;
	alignContent?: import("csstype").Property.AlignContent | undefined;
	alignItems?: import("csstype").Property.AlignItems | undefined;
	alignSelf?: import("csstype").Property.AlignSelf | undefined;
	alignTracks?: import("csstype").Property.AlignTracks | undefined;
	alignmentBaseline?: import("csstype").Property.AlignmentBaseline | undefined;
	anchorName?: import("csstype").Property.AnchorName | undefined;
	anchorScope?: import("csstype").Property.AnchorScope | undefined;
	animationComposition?: import("csstype").Property.AnimationComposition | undefined;
	animationDelay?: import("csstype").Property.AnimationDelay<string & {}> | undefined;
	animationDirection?: import("csstype").Property.AnimationDirection | undefined;
	animationDuration?: import("csstype").Property.AnimationDuration<string & {}> | undefined;
	animationFillMode?: import("csstype").Property.AnimationFillMode | undefined;
	animationIterationCount?: import("csstype").Property.AnimationIterationCount | undefined;
	animationName?: import("csstype").Property.AnimationName | undefined;
	animationPlayState?: import("csstype").Property.AnimationPlayState | undefined;
	animationRangeEnd?: import("csstype").Property.AnimationRangeEnd<string | number> | undefined;
	animationRangeStart?: import("csstype").Property.AnimationRangeStart<string | number> | undefined;
	animationTimeline?: import("csstype").Property.AnimationTimeline | undefined;
	animationTimingFunction?: import("csstype").Property.AnimationTimingFunction | undefined;
	appearance?: import("csstype").Property.Appearance | undefined;
	aspectRatio?: import("csstype").Property.AspectRatio | undefined;
	backdropFilter?: import("csstype").Property.BackdropFilter | undefined;
	backfaceVisibility?: import("csstype").Property.BackfaceVisibility | undefined;
	backgroundAttachment?: import("csstype").Property.BackgroundAttachment | undefined;
	backgroundBlendMode?: import("csstype").Property.BackgroundBlendMode | undefined;
	backgroundClip?: import("csstype").Property.BackgroundClip | undefined;
	backgroundColor?: import("csstype").Property.BackgroundColor | undefined;
	backgroundImage?: import("csstype").Property.BackgroundImage | undefined;
	backgroundOrigin?: import("csstype").Property.BackgroundOrigin | undefined;
	backgroundPositionX?: import("csstype").Property.BackgroundPositionX<string | number> | undefined;
	backgroundPositionY?: import("csstype").Property.BackgroundPositionY<string | number> | undefined;
	backgroundRepeat?: import("csstype").Property.BackgroundRepeat | undefined;
	backgroundSize?: import("csstype").Property.BackgroundSize<string | number> | undefined;
	baselineShift?: import("csstype").Property.BaselineShift<string | number> | undefined;
	blockSize?: import("csstype").Property.BlockSize<string | number> | undefined;
	borderBlockEndColor?: import("csstype").Property.BorderBlockEndColor | undefined;
	borderBlockEndStyle?: import("csstype").Property.BorderBlockEndStyle | undefined;
	borderBlockEndWidth?: import("csstype").Property.BorderBlockEndWidth<string | number> | undefined;
	borderBlockStartColor?: import("csstype").Property.BorderBlockStartColor | undefined;
	borderBlockStartStyle?: import("csstype").Property.BorderBlockStartStyle | undefined;
	borderBlockStartWidth?: import("csstype").Property.BorderBlockStartWidth<string | number> | undefined;
	borderBottomColor?: import("csstype").Property.BorderBottomColor | undefined;
	borderBottomLeftRadius?: import("csstype").Property.BorderBottomLeftRadius<string | number> | undefined;
	borderBottomRightRadius?: import("csstype").Property.BorderBottomRightRadius<string | number> | undefined;
	borderBottomStyle?: import("csstype").Property.BorderBottomStyle | undefined;
	borderBottomWidth?: import("csstype").Property.BorderBottomWidth<string | number> | undefined;
	borderCollapse?: import("csstype").Property.BorderCollapse | undefined;
	borderEndEndRadius?: import("csstype").Property.BorderEndEndRadius<string | number> | undefined;
	borderEndStartRadius?: import("csstype").Property.BorderEndStartRadius<string | number> | undefined;
	borderImageOutset?: import("csstype").Property.BorderImageOutset<string | number> | undefined;
	borderImageRepeat?: import("csstype").Property.BorderImageRepeat | undefined;
	borderImageSlice?: import("csstype").Property.BorderImageSlice | undefined;
	borderImageSource?: import("csstype").Property.BorderImageSource | undefined;
	borderImageWidth?: import("csstype").Property.BorderImageWidth<string | number> | undefined;
	borderInlineEndColor?: import("csstype").Property.BorderInlineEndColor | undefined;
	borderInlineEndStyle?: import("csstype").Property.BorderInlineEndStyle | undefined;
	borderInlineEndWidth?: import("csstype").Property.BorderInlineEndWidth<string | number> | undefined;
	borderInlineStartColor?: import("csstype").Property.BorderInlineStartColor | undefined;
	borderInlineStartStyle?: import("csstype").Property.BorderInlineStartStyle | undefined;
	borderInlineStartWidth?: import("csstype").Property.BorderInlineStartWidth<string | number> | undefined;
	borderLeftColor?: import("csstype").Property.BorderLeftColor | undefined;
	borderLeftStyle?: import("csstype").Property.BorderLeftStyle | undefined;
	borderLeftWidth?: import("csstype").Property.BorderLeftWidth<string | number> | undefined;
	borderRightColor?: import("csstype").Property.BorderRightColor | undefined;
	borderRightStyle?: import("csstype").Property.BorderRightStyle | undefined;
	borderRightWidth?: import("csstype").Property.BorderRightWidth<string | number> | undefined;
	borderSpacing?: import("csstype").Property.BorderSpacing<string | number> | undefined;
	borderStartEndRadius?: import("csstype").Property.BorderStartEndRadius<string | number> | undefined;
	borderStartStartRadius?: import("csstype").Property.BorderStartStartRadius<string | number> | undefined;
	borderTopColor?: import("csstype").Property.BorderTopColor | undefined;
	borderTopLeftRadius?: import("csstype").Property.BorderTopLeftRadius<string | number> | undefined;
	borderTopRightRadius?: import("csstype").Property.BorderTopRightRadius<string | number> | undefined;
	borderTopStyle?: import("csstype").Property.BorderTopStyle | undefined;
	borderTopWidth?: import("csstype").Property.BorderTopWidth<string | number> | undefined;
	bottom?: import("csstype").Property.Bottom<string | number> | undefined;
	boxDecorationBreak?: import("csstype").Property.BoxDecorationBreak | undefined;
	boxShadow?: import("csstype").Property.BoxShadow | undefined;
	boxSizing?: import("csstype").Property.BoxSizing | undefined;
	breakAfter?: import("csstype").Property.BreakAfter | undefined;
	breakBefore?: import("csstype").Property.BreakBefore | undefined;
	breakInside?: import("csstype").Property.BreakInside | undefined;
	captionSide?: import("csstype").Property.CaptionSide | undefined;
	caretColor?: import("csstype").Property.CaretColor | undefined;
	caretShape?: import("csstype").Property.CaretShape | undefined;
	clear?: import("csstype").Property.Clear | undefined;
	clipPath?: import("csstype").Property.ClipPath | undefined;
	clipRule?: import("csstype").Property.ClipRule | undefined;
	colorAdjust?: import("csstype").Property.PrintColorAdjust | undefined;
	colorInterpolationFilters?: import("csstype").Property.ColorInterpolationFilters | undefined;
	colorScheme?: import("csstype").Property.ColorScheme | undefined;
	columnCount?: import("csstype").Property.ColumnCount | undefined;
	columnFill?: import("csstype").Property.ColumnFill | undefined;
	columnGap?: import("csstype").Property.ColumnGap<string | number> | undefined;
	columnRuleColor?: import("csstype").Property.ColumnRuleColor | undefined;
	columnRuleStyle?: import("csstype").Property.ColumnRuleStyle | undefined;
	columnRuleWidth?: import("csstype").Property.ColumnRuleWidth<string | number> | undefined;
	columnSpan?: import("csstype").Property.ColumnSpan | undefined;
	columnWidth?: import("csstype").Property.ColumnWidth<string | number> | undefined;
	contain?: import("csstype").Property.Contain | undefined;
	containIntrinsicBlockSize?: import("csstype").Property.ContainIntrinsicBlockSize<string | number> | undefined;
	containIntrinsicHeight?: import("csstype").Property.ContainIntrinsicHeight<string | number> | undefined;
	containIntrinsicInlineSize?: import("csstype").Property.ContainIntrinsicInlineSize<string | number> | undefined;
	containIntrinsicWidth?: import("csstype").Property.ContainIntrinsicWidth<string | number> | undefined;
	containerName?: import("csstype").Property.ContainerName | undefined;
	containerType?: import("csstype").Property.ContainerType | undefined;
	content?: import("csstype").Property.Content | undefined;
	contentVisibility?: import("csstype").Property.ContentVisibility | undefined;
	counterIncrement?: import("csstype").Property.CounterIncrement | undefined;
	counterReset?: import("csstype").Property.CounterReset | undefined;
	counterSet?: import("csstype").Property.CounterSet | undefined;
	cursor?: import("csstype").Property.Cursor | undefined;
	cx?: import("csstype").Property.Cx<string | number> | undefined;
	cy?: import("csstype").Property.Cy<string | number> | undefined;
	d?: import("csstype").Property.D | undefined;
	direction?: import("csstype").Property.Direction | undefined;
	display?: import("csstype").Property.Display | undefined;
	dominantBaseline?: import("csstype").Property.DominantBaseline | undefined;
	emptyCells?: import("csstype").Property.EmptyCells | undefined;
	fieldSizing?: import("csstype").Property.FieldSizing | undefined;
	fillOpacity?: import("csstype").Property.FillOpacity | undefined;
	fillRule?: import("csstype").Property.FillRule | undefined;
	flexBasis?: import("csstype").Property.FlexBasis<string | number> | undefined;
	flexDirection?: import("csstype").Property.FlexDirection | undefined;
	flexGrow?: import("csstype").Property.FlexGrow | undefined;
	flexShrink?: import("csstype").Property.FlexShrink | undefined;
	flexWrap?: import("csstype").Property.FlexWrap | undefined;
	float?: import("csstype").Property.Float | undefined;
	floodColor?: import("csstype").Property.FloodColor | undefined;
	floodOpacity?: import("csstype").Property.FloodOpacity | undefined;
	fontFamily?: import("csstype").Property.FontFamily | undefined;
	fontFeatureSettings?: import("csstype").Property.FontFeatureSettings | undefined;
	fontKerning?: import("csstype").Property.FontKerning | undefined;
	fontLanguageOverride?: import("csstype").Property.FontLanguageOverride | undefined;
	fontOpticalSizing?: import("csstype").Property.FontOpticalSizing | undefined;
	fontPalette?: import("csstype").Property.FontPalette | undefined;
	fontSize?: import("csstype").Property.FontSize<string | number> | undefined;
	fontSizeAdjust?: import("csstype").Property.FontSizeAdjust | undefined;
	fontSmooth?: import("csstype").Property.FontSmooth<string | number> | undefined;
	fontStyle?: import("csstype").Property.FontStyle | undefined;
	fontSynthesis?: import("csstype").Property.FontSynthesis | undefined;
	fontSynthesisPosition?: import("csstype").Property.FontSynthesisPosition | undefined;
	fontSynthesisSmallCaps?: import("csstype").Property.FontSynthesisSmallCaps | undefined;
	fontSynthesisStyle?: import("csstype").Property.FontSynthesisStyle | undefined;
	fontSynthesisWeight?: import("csstype").Property.FontSynthesisWeight | undefined;
	fontVariant?: import("csstype").Property.FontVariant | undefined;
	fontVariantAlternates?: import("csstype").Property.FontVariantAlternates | undefined;
	fontVariantCaps?: import("csstype").Property.FontVariantCaps | undefined;
	fontVariantEastAsian?: import("csstype").Property.FontVariantEastAsian | undefined;
	fontVariantEmoji?: import("csstype").Property.FontVariantEmoji | undefined;
	fontVariantLigatures?: import("csstype").Property.FontVariantLigatures | undefined;
	fontVariantNumeric?: import("csstype").Property.FontVariantNumeric | undefined;
	fontVariantPosition?: import("csstype").Property.FontVariantPosition | undefined;
	fontVariationSettings?: import("csstype").Property.FontVariationSettings | undefined;
	fontWidth?: import("csstype").Property.FontWidth | undefined;
	forcedColorAdjust?: import("csstype").Property.ForcedColorAdjust | undefined;
	gridAutoColumns?: import("csstype").Property.GridAutoColumns<string | number> | undefined;
	gridAutoFlow?: import("csstype").Property.GridAutoFlow | undefined;
	gridAutoRows?: import("csstype").Property.GridAutoRows<string | number> | undefined;
	gridColumnEnd?: import("csstype").Property.GridColumnEnd | undefined;
	gridColumnStart?: import("csstype").Property.GridColumnStart | undefined;
	gridRowEnd?: import("csstype").Property.GridRowEnd | undefined;
	gridRowStart?: import("csstype").Property.GridRowStart | undefined;
	gridTemplateAreas?: import("csstype").Property.GridTemplateAreas | undefined;
	gridTemplateColumns?: import("csstype").Property.GridTemplateColumns<string | number> | undefined;
	gridTemplateRows?: import("csstype").Property.GridTemplateRows<string | number> | undefined;
	hangingPunctuation?: import("csstype").Property.HangingPunctuation | undefined;
	height?: import("csstype").Property.Height<string | number> | undefined;
	hyphenateCharacter?: import("csstype").Property.HyphenateCharacter | undefined;
	hyphenateLimitChars?: import("csstype").Property.HyphenateLimitChars | undefined;
	hyphens?: import("csstype").Property.Hyphens | undefined;
	imageOrientation?: import("csstype").Property.ImageOrientation | undefined;
	imageRendering?: import("csstype").Property.ImageRendering | undefined;
	imageResolution?: import("csstype").Property.ImageResolution | undefined;
	initialLetter?: import("csstype").Property.InitialLetter | undefined;
	initialLetterAlign?: import("csstype").Property.InitialLetterAlign | undefined;
	inlineSize?: import("csstype").Property.InlineSize<string | number> | undefined;
	insetBlockEnd?: import("csstype").Property.InsetBlockEnd<string | number> | undefined;
	insetBlockStart?: import("csstype").Property.InsetBlockStart<string | number> | undefined;
	insetInlineEnd?: import("csstype").Property.InsetInlineEnd<string | number> | undefined;
	insetInlineStart?: import("csstype").Property.InsetInlineStart<string | number> | undefined;
	interpolateSize?: import("csstype").Property.InterpolateSize | undefined;
	isolation?: import("csstype").Property.Isolation | undefined;
	justifyContent?: import("csstype").Property.JustifyContent | undefined;
	justifyItems?: import("csstype").Property.JustifyItems | undefined;
	justifySelf?: import("csstype").Property.JustifySelf | undefined;
	justifyTracks?: import("csstype").Property.JustifyTracks | undefined;
	left?: import("csstype").Property.Left<string | number> | undefined;
	letterSpacing?: import("csstype").Property.LetterSpacing<string | number> | undefined;
	lightingColor?: import("csstype").Property.LightingColor | undefined;
	lineBreak?: import("csstype").Property.LineBreak | undefined;
	lineHeight?: import("csstype").Property.LineHeight<string | number> | undefined;
	lineHeightStep?: import("csstype").Property.LineHeightStep<string | number> | undefined;
	listStyleImage?: import("csstype").Property.ListStyleImage | undefined;
	listStylePosition?: import("csstype").Property.ListStylePosition | undefined;
	listStyleType?: import("csstype").Property.ListStyleType | undefined;
	marginBlockEnd?: import("csstype").Property.MarginBlockEnd<string | number> | undefined;
	marginBlockStart?: import("csstype").Property.MarginBlockStart<string | number> | undefined;
	marginBottom?: import("csstype").Property.MarginBottom<string | number> | undefined;
	marginInlineEnd?: import("csstype").Property.MarginInlineEnd<string | number> | undefined;
	marginInlineStart?: import("csstype").Property.MarginInlineStart<string | number> | undefined;
	marginLeft?: import("csstype").Property.MarginLeft<string | number> | undefined;
	marginRight?: import("csstype").Property.MarginRight<string | number> | undefined;
	marginTop?: import("csstype").Property.MarginTop<string | number> | undefined;
	marginTrim?: import("csstype").Property.MarginTrim | undefined;
	marker?: import("csstype").Property.Marker | undefined;
	markerEnd?: import("csstype").Property.MarkerEnd | undefined;
	markerMid?: import("csstype").Property.MarkerMid | undefined;
	markerStart?: import("csstype").Property.MarkerStart | undefined;
	maskBorderMode?: import("csstype").Property.MaskBorderMode | undefined;
	maskBorderOutset?: import("csstype").Property.MaskBorderOutset<string | number> | undefined;
	maskBorderRepeat?: import("csstype").Property.MaskBorderRepeat | undefined;
	maskBorderSlice?: import("csstype").Property.MaskBorderSlice | undefined;
	maskBorderSource?: import("csstype").Property.MaskBorderSource | undefined;
	maskBorderWidth?: import("csstype").Property.MaskBorderWidth<string | number> | undefined;
	maskClip?: import("csstype").Property.MaskClip | undefined;
	maskComposite?: import("csstype").Property.MaskComposite | undefined;
	maskImage?: import("csstype").Property.MaskImage | undefined;
	maskMode?: import("csstype").Property.MaskMode | undefined;
	maskOrigin?: import("csstype").Property.MaskOrigin | undefined;
	maskPosition?: import("csstype").Property.MaskPosition<string | number> | undefined;
	maskRepeat?: import("csstype").Property.MaskRepeat | undefined;
	maskSize?: import("csstype").Property.MaskSize<string | number> | undefined;
	maskType?: import("csstype").Property.MaskType | undefined;
	masonryAutoFlow?: import("csstype").Property.MasonryAutoFlow | undefined;
	mathDepth?: import("csstype").Property.MathDepth | undefined;
	mathShift?: import("csstype").Property.MathShift | undefined;
	mathStyle?: import("csstype").Property.MathStyle | undefined;
	maxBlockSize?: import("csstype").Property.MaxBlockSize<string | number> | undefined;
	maxHeight?: import("csstype").Property.MaxHeight<string | number> | undefined;
	maxInlineSize?: import("csstype").Property.MaxInlineSize<string | number> | undefined;
	maxLines?: import("csstype").Property.MaxLines | undefined;
	maxWidth?: import("csstype").Property.MaxWidth<string | number> | undefined;
	minBlockSize?: import("csstype").Property.MinBlockSize<string | number> | undefined;
	minHeight?: import("csstype").Property.MinHeight<string | number> | undefined;
	minInlineSize?: import("csstype").Property.MinInlineSize<string | number> | undefined;
	minWidth?: import("csstype").Property.MinWidth<string | number> | undefined;
	mixBlendMode?: import("csstype").Property.MixBlendMode | undefined;
	motionDistance?: import("csstype").Property.OffsetDistance<string | number> | undefined;
	motionPath?: import("csstype").Property.OffsetPath | undefined;
	motionRotation?: import("csstype").Property.OffsetRotate | undefined;
	objectFit?: import("csstype").Property.ObjectFit | undefined;
	objectPosition?: import("csstype").Property.ObjectPosition<string | number> | undefined;
	objectViewBox?: import("csstype").Property.ObjectViewBox | undefined;
	offsetAnchor?: import("csstype").Property.OffsetAnchor<string | number> | undefined;
	offsetDistance?: import("csstype").Property.OffsetDistance<string | number> | undefined;
	offsetPath?: import("csstype").Property.OffsetPath | undefined;
	offsetPosition?: import("csstype").Property.OffsetPosition<string | number> | undefined;
	offsetRotate?: import("csstype").Property.OffsetRotate | undefined;
	offsetRotation?: import("csstype").Property.OffsetRotate | undefined;
	opacity?: import("csstype").Property.Opacity | undefined;
	order?: import("csstype").Property.Order | undefined;
	orphans?: import("csstype").Property.Orphans | undefined;
	outlineColor?: import("csstype").Property.OutlineColor | undefined;
	outlineOffset?: import("csstype").Property.OutlineOffset<string | number> | undefined;
	outlineStyle?: import("csstype").Property.OutlineStyle | undefined;
	outlineWidth?: import("csstype").Property.OutlineWidth<string | number> | undefined;
	overflowAnchor?: import("csstype").Property.OverflowAnchor | undefined;
	overflowBlock?: import("csstype").Property.OverflowBlock | undefined;
	overflowClipBox?: import("csstype").Property.OverflowClipBox | undefined;
	overflowClipMargin?: import("csstype").Property.OverflowClipMargin<string | number> | undefined;
	overflowInline?: import("csstype").Property.OverflowInline | undefined;
	overflowWrap?: import("csstype").Property.OverflowWrap | undefined;
	overflowX?: import("csstype").Property.OverflowX | undefined;
	overflowY?: import("csstype").Property.OverflowY | undefined;
	overlay?: import("csstype").Property.Overlay | undefined;
	overscrollBehaviorBlock?: import("csstype").Property.OverscrollBehaviorBlock | undefined;
	overscrollBehaviorInline?: import("csstype").Property.OverscrollBehaviorInline | undefined;
	overscrollBehaviorX?: import("csstype").Property.OverscrollBehaviorX | undefined;
	overscrollBehaviorY?: import("csstype").Property.OverscrollBehaviorY | undefined;
	paddingBlockEnd?: import("csstype").Property.PaddingBlockEnd<string | number> | undefined;
	paddingBlockStart?: import("csstype").Property.PaddingBlockStart<string | number> | undefined;
	paddingBottom?: import("csstype").Property.PaddingBottom<string | number> | undefined;
	paddingInlineEnd?: import("csstype").Property.PaddingInlineEnd<string | number> | undefined;
	paddingInlineStart?: import("csstype").Property.PaddingInlineStart<string | number> | undefined;
	paddingLeft?: import("csstype").Property.PaddingLeft<string | number> | undefined;
	paddingRight?: import("csstype").Property.PaddingRight<string | number> | undefined;
	paddingTop?: import("csstype").Property.PaddingTop<string | number> | undefined;
	page?: import("csstype").Property.Page | undefined;
	paintOrder?: import("csstype").Property.PaintOrder | undefined;
	perspective?: import("csstype").Property.Perspective<string | number> | undefined;
	perspectiveOrigin?: import("csstype").Property.PerspectiveOrigin<string | number> | undefined;
	pointerEvents?: import("csstype").Property.PointerEvents | undefined;
	position?: import("csstype").Property.Position | undefined;
	positionAnchor?: import("csstype").Property.PositionAnchor | undefined;
	positionArea?: import("csstype").Property.PositionArea | undefined;
	positionTryFallbacks?: import("csstype").Property.PositionTryFallbacks | undefined;
	positionTryOrder?: import("csstype").Property.PositionTryOrder | undefined;
	positionVisibility?: import("csstype").Property.PositionVisibility | undefined;
	printColorAdjust?: import("csstype").Property.PrintColorAdjust | undefined;
	quotes?: import("csstype").Property.Quotes | undefined;
	r?: import("csstype").Property.R<string | number> | undefined;
	resize?: import("csstype").Property.Resize | undefined;
	right?: import("csstype").Property.Right<string | number> | undefined;
	rotate?: import("csstype").Property.Rotate | undefined;
	rowGap?: import("csstype").Property.RowGap<string | number> | undefined;
	rubyAlign?: import("csstype").Property.RubyAlign | undefined;
	rubyMerge?: import("csstype").Property.RubyMerge | undefined;
	rubyOverhang?: import("csstype").Property.RubyOverhang | undefined;
	rubyPosition?: import("csstype").Property.RubyPosition | undefined;
	rx?: import("csstype").Property.Rx<string | number> | undefined;
	ry?: import("csstype").Property.Ry<string | number> | undefined;
	scale?: import("csstype").Property.Scale | undefined;
	scrollBehavior?: import("csstype").Property.ScrollBehavior | undefined;
	scrollInitialTarget?: import("csstype").Property.ScrollInitialTarget | undefined;
	scrollMarginBlockEnd?: import("csstype").Property.ScrollMarginBlockEnd<string | number> | undefined;
	scrollMarginBlockStart?: import("csstype").Property.ScrollMarginBlockStart<string | number> | undefined;
	scrollMarginBottom?: import("csstype").Property.ScrollMarginBottom<string | number> | undefined;
	scrollMarginInlineEnd?: import("csstype").Property.ScrollMarginInlineEnd<string | number> | undefined;
	scrollMarginInlineStart?: import("csstype").Property.ScrollMarginInlineStart<string | number> | undefined;
	scrollMarginLeft?: import("csstype").Property.ScrollMarginLeft<string | number> | undefined;
	scrollMarginRight?: import("csstype").Property.ScrollMarginRight<string | number> | undefined;
	scrollMarginTop?: import("csstype").Property.ScrollMarginTop<string | number> | undefined;
	scrollPaddingBlockEnd?: import("csstype").Property.ScrollPaddingBlockEnd<string | number> | undefined;
	scrollPaddingBlockStart?: import("csstype").Property.ScrollPaddingBlockStart<string | number> | undefined;
	scrollPaddingBottom?: import("csstype").Property.ScrollPaddingBottom<string | number> | undefined;
	scrollPaddingInlineEnd?: import("csstype").Property.ScrollPaddingInlineEnd<string | number> | undefined;
	scrollPaddingInlineStart?: import("csstype").Property.ScrollPaddingInlineStart<string | number> | undefined;
	scrollPaddingLeft?: import("csstype").Property.ScrollPaddingLeft<string | number> | undefined;
	scrollPaddingRight?: import("csstype").Property.ScrollPaddingRight<string | number> | undefined;
	scrollPaddingTop?: import("csstype").Property.ScrollPaddingTop<string | number> | undefined;
	scrollSnapAlign?: import("csstype").Property.ScrollSnapAlign | undefined;
	scrollSnapMarginBottom?: import("csstype").Property.ScrollMarginBottom<string | number> | undefined;
	scrollSnapMarginLeft?: import("csstype").Property.ScrollMarginLeft<string | number> | undefined;
	scrollSnapMarginRight?: import("csstype").Property.ScrollMarginRight<string | number> | undefined;
	scrollSnapMarginTop?: import("csstype").Property.ScrollMarginTop<string | number> | undefined;
	scrollSnapStop?: import("csstype").Property.ScrollSnapStop | undefined;
	scrollSnapType?: import("csstype").Property.ScrollSnapType | undefined;
	scrollTimelineAxis?: import("csstype").Property.ScrollTimelineAxis | undefined;
	scrollTimelineName?: import("csstype").Property.ScrollTimelineName | undefined;
	scrollbarColor?: import("csstype").Property.ScrollbarColor | undefined;
	scrollbarGutter?: import("csstype").Property.ScrollbarGutter | undefined;
	scrollbarWidth?: import("csstype").Property.ScrollbarWidth | undefined;
	shapeImageThreshold?: import("csstype").Property.ShapeImageThreshold | undefined;
	shapeMargin?: import("csstype").Property.ShapeMargin<string | number> | undefined;
	shapeOutside?: import("csstype").Property.ShapeOutside | undefined;
	shapeRendering?: import("csstype").Property.ShapeRendering | undefined;
	speakAs?: import("csstype").Property.SpeakAs | undefined;
	stopColor?: import("csstype").Property.StopColor | undefined;
	stopOpacity?: import("csstype").Property.StopOpacity | undefined;
	stroke?: import("csstype").Property.Stroke | undefined;
	strokeColor?: import("csstype").Property.StrokeColor | undefined;
	strokeDasharray?: import("csstype").Property.StrokeDasharray<string | number> | undefined;
	strokeDashoffset?: import("csstype").Property.StrokeDashoffset<string | number> | undefined;
	strokeLinecap?: import("csstype").Property.StrokeLinecap | undefined;
	strokeLinejoin?: import("csstype").Property.StrokeLinejoin | undefined;
	strokeMiterlimit?: import("csstype").Property.StrokeMiterlimit | undefined;
	strokeOpacity?: import("csstype").Property.StrokeOpacity | undefined;
	strokeWidth?: import("csstype").Property.StrokeWidth<string | number> | undefined;
	tabSize?: import("csstype").Property.TabSize<string | number> | undefined;
	tableLayout?: import("csstype").Property.TableLayout | undefined;
	textAlign?: import("csstype").Property.TextAlign | undefined;
	textAlignLast?: import("csstype").Property.TextAlignLast | undefined;
	textAnchor?: import("csstype").Property.TextAnchor | undefined;
	textAutospace?: import("csstype").Property.TextAutospace | undefined;
	textBox?: import("csstype").Property.TextBox | undefined;
	textBoxEdge?: import("csstype").Property.TextBoxEdge | undefined;
	textBoxTrim?: import("csstype").Property.TextBoxTrim | undefined;
	textCombineUpright?: import("csstype").Property.TextCombineUpright | undefined;
	textDecorationColor?: import("csstype").Property.TextDecorationColor | undefined;
	textDecorationLine?: import("csstype").Property.TextDecorationLine | undefined;
	textDecorationSkip?: import("csstype").Property.TextDecorationSkip | undefined;
	textDecorationSkipInk?: import("csstype").Property.TextDecorationSkipInk | undefined;
	textDecorationStyle?: import("csstype").Property.TextDecorationStyle | undefined;
	textDecorationThickness?: import("csstype").Property.TextDecorationThickness<string | number> | undefined;
	textEmphasisColor?: import("csstype").Property.TextEmphasisColor | undefined;
	textEmphasisPosition?: import("csstype").Property.TextEmphasisPosition | undefined;
	textEmphasisStyle?: import("csstype").Property.TextEmphasisStyle | undefined;
	textIndent?: import("csstype").Property.TextIndent<string | number> | undefined;
	textJustify?: import("csstype").Property.TextJustify | undefined;
	textOrientation?: import("csstype").Property.TextOrientation | undefined;
	textOverflow?: import("csstype").Property.TextOverflow | undefined;
	textRendering?: import("csstype").Property.TextRendering | undefined;
	textShadow?: import("csstype").Property.TextShadow | undefined;
	textSizeAdjust?: import("csstype").Property.TextSizeAdjust | undefined;
	textSpacingTrim?: import("csstype").Property.TextSpacingTrim | undefined;
	textTransform?: import("csstype").Property.TextTransform | undefined;
	textUnderlineOffset?: import("csstype").Property.TextUnderlineOffset<string | number> | undefined;
	textUnderlinePosition?: import("csstype").Property.TextUnderlinePosition | undefined;
	textWrapMode?: import("csstype").Property.TextWrapMode | undefined;
	textWrapStyle?: import("csstype").Property.TextWrapStyle | undefined;
	timelineScope?: import("csstype").Property.TimelineScope | undefined;
	top?: import("csstype").Property.Top<string | number> | undefined;
	touchAction?: import("csstype").Property.TouchAction | undefined;
	transform?: import("csstype").Property.Transform | undefined;
	transformBox?: import("csstype").Property.TransformBox | undefined;
	transformOrigin?: import("csstype").Property.TransformOrigin<string | number> | undefined;
	transformStyle?: import("csstype").Property.TransformStyle | undefined;
	transitionBehavior?: import("csstype").Property.TransitionBehavior | undefined;
	transitionDelay?: import("csstype").Property.TransitionDelay<string & {}> | undefined;
	transitionDuration?: import("csstype").Property.TransitionDuration<string & {}> | undefined;
	transitionProperty?: import("csstype").Property.TransitionProperty | undefined;
	transitionTimingFunction?: import("csstype").Property.TransitionTimingFunction | undefined;
	translate?: import("csstype").Property.Translate<string | number> | undefined;
	unicodeBidi?: import("csstype").Property.UnicodeBidi | undefined;
	userSelect?: import("csstype").Property.UserSelect | undefined;
	vectorEffect?: import("csstype").Property.VectorEffect | undefined;
	verticalAlign?: import("csstype").Property.VerticalAlign<string | number> | undefined;
	viewTimelineAxis?: import("csstype").Property.ViewTimelineAxis | undefined;
	viewTimelineInset?: import("csstype").Property.ViewTimelineInset<string | number> | undefined;
	viewTimelineName?: import("csstype").Property.ViewTimelineName | undefined;
	viewTransitionClass?: import("csstype").Property.ViewTransitionClass | undefined;
	viewTransitionName?: import("csstype").Property.ViewTransitionName | undefined;
	visibility?: import("csstype").Property.Visibility | undefined;
	whiteSpace?: import("csstype").Property.WhiteSpace | undefined;
	whiteSpaceCollapse?: import("csstype").Property.WhiteSpaceCollapse | undefined;
	widows?: import("csstype").Property.Widows | undefined;
	width?: import("csstype").Property.Width<string | number> | undefined;
	willChange?: import("csstype").Property.WillChange | undefined;
	wordBreak?: import("csstype").Property.WordBreak | undefined;
	wordSpacing?: import("csstype").Property.WordSpacing<string | number> | undefined;
	wordWrap?: import("csstype").Property.WordWrap | undefined;
	writingMode?: import("csstype").Property.WritingMode | undefined;
	x?: import("csstype").Property.X<string | number> | undefined;
	y?: import("csstype").Property.Y<string | number> | undefined;
	zIndex?: import("csstype").Property.ZIndex | undefined;
	zoom?: import("csstype").Property.Zoom | undefined;
	all?: import("csstype").Globals | undefined;
	animation?: import("csstype").Property.Animation<string & {}> | undefined;
	animationRange?: import("csstype").Property.AnimationRange<string | number> | undefined;
	background?: import("csstype").Property.Background<string | number> | undefined;
	backgroundPosition?: import("csstype").Property.BackgroundPosition<string | number> | undefined;
	border?: import("csstype").Property.Border<string | number> | undefined;
	borderBlock?: import("csstype").Property.BorderBlock<string | number> | undefined;
	borderBlockColor?: import("csstype").Property.BorderBlockColor | undefined;
	borderBlockEnd?: import("csstype").Property.BorderBlockEnd<string | number> | undefined;
	borderBlockStart?: import("csstype").Property.BorderBlockStart<string | number> | undefined;
	borderBlockStyle?: import("csstype").Property.BorderBlockStyle | undefined;
	borderBlockWidth?: import("csstype").Property.BorderBlockWidth<string | number> | undefined;
	borderBottom?: import("csstype").Property.BorderBottom<string | number> | undefined;
	borderColor?: import("csstype").Property.BorderColor | undefined;
	borderImage?: import("csstype").Property.BorderImage | undefined;
	borderInline?: import("csstype").Property.BorderInline<string | number> | undefined;
	borderInlineColor?: import("csstype").Property.BorderInlineColor | undefined;
	borderInlineEnd?: import("csstype").Property.BorderInlineEnd<string | number> | undefined;
	borderInlineStart?: import("csstype").Property.BorderInlineStart<string | number> | undefined;
	borderInlineStyle?: import("csstype").Property.BorderInlineStyle | undefined;
	borderInlineWidth?: import("csstype").Property.BorderInlineWidth<string | number> | undefined;
	borderLeft?: import("csstype").Property.BorderLeft<string | number> | undefined;
	borderRadius?: import("csstype").Property.BorderRadius<string | number> | undefined;
	borderRight?: import("csstype").Property.BorderRight<string | number> | undefined;
	borderStyle?: import("csstype").Property.BorderStyle | undefined;
	borderTop?: import("csstype").Property.BorderTop<string | number> | undefined;
	borderWidth?: import("csstype").Property.BorderWidth<string | number> | undefined;
	caret?: import("csstype").Property.Caret | undefined;
	columnRule?: import("csstype").Property.ColumnRule<string | number> | undefined;
	columns?: import("csstype").Property.Columns<string | number> | undefined;
	containIntrinsicSize?: import("csstype").Property.ContainIntrinsicSize<string | number> | undefined;
	container?: import("csstype").Property.Container | undefined;
	flex?: import("csstype").Property.Flex<string | number> | undefined;
	flexFlow?: import("csstype").Property.FlexFlow | undefined;
	font?: import("csstype").Property.Font | undefined;
	gap?: import("csstype").Property.Gap<string | number> | undefined;
	grid?: import("csstype").Property.Grid | undefined;
	gridArea?: import("csstype").Property.GridArea | undefined;
	gridColumn?: import("csstype").Property.GridColumn | undefined;
	gridRow?: import("csstype").Property.GridRow | undefined;
	gridTemplate?: import("csstype").Property.GridTemplate | undefined;
	inset?: import("csstype").Property.Inset<string | number> | undefined;
	insetBlock?: import("csstype").Property.InsetBlock<string | number> | undefined;
	insetInline?: import("csstype").Property.InsetInline<string | number> | undefined;
	lineClamp?: import("csstype").Property.LineClamp | undefined;
	listStyle?: import("csstype").Property.ListStyle | undefined;
	margin?: import("csstype").Property.Margin<string | number> | undefined;
	marginBlock?: import("csstype").Property.MarginBlock<string | number> | undefined;
	marginInline?: import("csstype").Property.MarginInline<string | number> | undefined;
	mask?: import("csstype").Property.Mask<string | number> | undefined;
	maskBorder?: import("csstype").Property.MaskBorder | undefined;
	motion?: import("csstype").Property.Offset<string | number> | undefined;
	offset?: import("csstype").Property.Offset<string | number> | undefined;
	outline?: import("csstype").Property.Outline<string | number> | undefined;
	overflow?: import("csstype").Property.Overflow | undefined;
	overscrollBehavior?: import("csstype").Property.OverscrollBehavior | undefined;
	padding?: import("csstype").Property.Padding<string | number> | undefined;
	paddingBlock?: import("csstype").Property.PaddingBlock<string | number> | undefined;
	paddingInline?: import("csstype").Property.PaddingInline<string | number> | undefined;
	placeContent?: import("csstype").Property.PlaceContent | undefined;
	placeItems?: import("csstype").Property.PlaceItems | undefined;
	placeSelf?: import("csstype").Property.PlaceSelf | undefined;
	positionTry?: import("csstype").Property.PositionTry | undefined;
	scrollMargin?: import("csstype").Property.ScrollMargin<string | number> | undefined;
	scrollMarginBlock?: import("csstype").Property.ScrollMarginBlock<string | number> | undefined;
	scrollMarginInline?: import("csstype").Property.ScrollMarginInline<string | number> | undefined;
	scrollPadding?: import("csstype").Property.ScrollPadding<string | number> | undefined;
	scrollPaddingBlock?: import("csstype").Property.ScrollPaddingBlock<string | number> | undefined;
	scrollPaddingInline?: import("csstype").Property.ScrollPaddingInline<string | number> | undefined;
	scrollSnapMargin?: import("csstype").Property.ScrollMargin<string | number> | undefined;
	scrollTimeline?: import("csstype").Property.ScrollTimeline | undefined;
	textDecoration?: import("csstype").Property.TextDecoration<string | number> | undefined;
	textEmphasis?: import("csstype").Property.TextEmphasis | undefined;
	textWrap?: import("csstype").Property.TextWrap | undefined;
	transition?: import("csstype").Property.Transition<string & {}> | undefined;
	viewTimeline?: import("csstype").Property.ViewTimeline | undefined;
	MozAnimationDelay?: import("csstype").Property.AnimationDelay<string & {}> | undefined;
	MozAnimationDirection?: import("csstype").Property.AnimationDirection | undefined;
	MozAnimationDuration?: import("csstype").Property.AnimationDuration<string & {}> | undefined;
	MozAnimationFillMode?: import("csstype").Property.AnimationFillMode | undefined;
	MozAnimationIterationCount?: import("csstype").Property.AnimationIterationCount | undefined;
	MozAnimationName?: import("csstype").Property.AnimationName | undefined;
	MozAnimationPlayState?: import("csstype").Property.AnimationPlayState | undefined;
	MozAnimationTimingFunction?: import("csstype").Property.AnimationTimingFunction | undefined;
	MozAppearance?: import("csstype").Property.MozAppearance | undefined;
	MozBackfaceVisibility?: import("csstype").Property.BackfaceVisibility | undefined;
	MozBinding?: import("csstype").Property.MozBinding | undefined;
	MozBorderBottomColors?: import("csstype").Property.MozBorderBottomColors | undefined;
	MozBorderEndColor?: import("csstype").Property.BorderInlineEndColor | undefined;
	MozBorderEndStyle?: import("csstype").Property.BorderInlineEndStyle | undefined;
	MozBorderEndWidth?: import("csstype").Property.BorderInlineEndWidth<string | number> | undefined;
	MozBorderLeftColors?: import("csstype").Property.MozBorderLeftColors | undefined;
	MozBorderRightColors?: import("csstype").Property.MozBorderRightColors | undefined;
	MozBorderStartColor?: import("csstype").Property.BorderInlineStartColor | undefined;
	MozBorderStartStyle?: import("csstype").Property.BorderInlineStartStyle | undefined;
	MozBorderTopColors?: import("csstype").Property.MozBorderTopColors | undefined;
	MozBoxSizing?: import("csstype").Property.BoxSizing | undefined;
	MozColumnRuleColor?: import("csstype").Property.ColumnRuleColor | undefined;
	MozColumnRuleStyle?: import("csstype").Property.ColumnRuleStyle | undefined;
	MozColumnRuleWidth?: import("csstype").Property.ColumnRuleWidth<string | number> | undefined;
	MozColumnWidth?: import("csstype").Property.ColumnWidth<string | number> | undefined;
	MozContextProperties?: import("csstype").Property.MozContextProperties | undefined;
	MozFontFeatureSettings?: import("csstype").Property.FontFeatureSettings | undefined;
	MozFontLanguageOverride?: import("csstype").Property.FontLanguageOverride | undefined;
	MozHyphens?: import("csstype").Property.Hyphens | undefined;
	MozMarginEnd?: import("csstype").Property.MarginInlineEnd<string | number> | undefined;
	MozMarginStart?: import("csstype").Property.MarginInlineStart<string | number> | undefined;
	MozOrient?: import("csstype").Property.MozOrient | undefined;
	MozOsxFontSmoothing?: import("csstype").Property.FontSmooth<string | number> | undefined;
	MozOutlineRadiusBottomleft?: import("csstype").Property.MozOutlineRadiusBottomleft<string | number> | undefined;
	MozOutlineRadiusBottomright?: import("csstype").Property.MozOutlineRadiusBottomright<string | number> | undefined;
	MozOutlineRadiusTopleft?: import("csstype").Property.MozOutlineRadiusTopleft<string | number> | undefined;
	MozOutlineRadiusTopright?: import("csstype").Property.MozOutlineRadiusTopright<string | number> | undefined;
	MozPaddingEnd?: import("csstype").Property.PaddingInlineEnd<string | number> | undefined;
	MozPaddingStart?: import("csstype").Property.PaddingInlineStart<string | number> | undefined;
	MozPerspective?: import("csstype").Property.Perspective<string | number> | undefined;
	MozPerspectiveOrigin?: import("csstype").Property.PerspectiveOrigin<string | number> | undefined;
	MozStackSizing?: import("csstype").Property.MozStackSizing | undefined;
	MozTabSize?: import("csstype").Property.TabSize<string | number> | undefined;
	MozTextBlink?: import("csstype").Property.MozTextBlink | undefined;
	MozTextSizeAdjust?: import("csstype").Property.TextSizeAdjust | undefined;
	MozTransform?: import("csstype").Property.Transform | undefined;
	MozTransformOrigin?: import("csstype").Property.TransformOrigin<string | number> | undefined;
	MozTransformStyle?: import("csstype").Property.TransformStyle | undefined;
	MozUserModify?: import("csstype").Property.MozUserModify | undefined;
	MozUserSelect?: import("csstype").Property.UserSelect | undefined;
	MozWindowDragging?: import("csstype").Property.MozWindowDragging | undefined;
	MozWindowShadow?: import("csstype").Property.MozWindowShadow | undefined;
	msAccelerator?: import("csstype").Property.MsAccelerator | undefined;
	msBlockProgression?: import("csstype").Property.MsBlockProgression | undefined;
	msContentZoomChaining?: import("csstype").Property.MsContentZoomChaining | undefined;
	msContentZoomLimitMax?: import("csstype").Property.MsContentZoomLimitMax | undefined;
	msContentZoomLimitMin?: import("csstype").Property.MsContentZoomLimitMin | undefined;
	msContentZoomSnapPoints?: import("csstype").Property.MsContentZoomSnapPoints | undefined;
	msContentZoomSnapType?: import("csstype").Property.MsContentZoomSnapType | undefined;
	msContentZooming?: import("csstype").Property.MsContentZooming | undefined;
	msFilter?: import("csstype").Property.MsFilter | undefined;
	msFlexDirection?: import("csstype").Property.FlexDirection | undefined;
	msFlexPositive?: import("csstype").Property.FlexGrow | undefined;
	msFlowFrom?: import("csstype").Property.MsFlowFrom | undefined;
	msFlowInto?: import("csstype").Property.MsFlowInto | undefined;
	msGridColumns?: import("csstype").Property.MsGridColumns<string | number> | undefined;
	msGridRows?: import("csstype").Property.MsGridRows<string | number> | undefined;
	msHighContrastAdjust?: import("csstype").Property.MsHighContrastAdjust | undefined;
	msHyphenateLimitChars?: import("csstype").Property.MsHyphenateLimitChars | undefined;
	msHyphenateLimitLines?: import("csstype").Property.MsHyphenateLimitLines | undefined;
	msHyphenateLimitZone?: import("csstype").Property.MsHyphenateLimitZone<string | number> | undefined;
	msHyphens?: import("csstype").Property.Hyphens | undefined;
	msImeAlign?: import("csstype").Property.MsImeAlign | undefined;
	msLineBreak?: import("csstype").Property.LineBreak | undefined;
	msOrder?: import("csstype").Property.Order | undefined;
	msOverflowStyle?: import("csstype").Property.MsOverflowStyle | undefined;
	msOverflowX?: import("csstype").Property.OverflowX | undefined;
	msOverflowY?: import("csstype").Property.OverflowY | undefined;
	msScrollChaining?: import("csstype").Property.MsScrollChaining | undefined;
	msScrollLimitXMax?: import("csstype").Property.MsScrollLimitXMax<string | number> | undefined;
	msScrollLimitXMin?: import("csstype").Property.MsScrollLimitXMin<string | number> | undefined;
	msScrollLimitYMax?: import("csstype").Property.MsScrollLimitYMax<string | number> | undefined;
	msScrollLimitYMin?: import("csstype").Property.MsScrollLimitYMin<string | number> | undefined;
	msScrollRails?: import("csstype").Property.MsScrollRails | undefined;
	msScrollSnapPointsX?: import("csstype").Property.MsScrollSnapPointsX | undefined;
	msScrollSnapPointsY?: import("csstype").Property.MsScrollSnapPointsY | undefined;
	msScrollSnapType?: import("csstype").Property.MsScrollSnapType | undefined;
	msScrollTranslation?: import("csstype").Property.MsScrollTranslation | undefined;
	msScrollbar3dlightColor?: import("csstype").Property.MsScrollbar3dlightColor | undefined;
	msScrollbarArrowColor?: import("csstype").Property.MsScrollbarArrowColor | undefined;
	msScrollbarBaseColor?: import("csstype").Property.MsScrollbarBaseColor | undefined;
	msScrollbarDarkshadowColor?: import("csstype").Property.MsScrollbarDarkshadowColor | undefined;
	msScrollbarFaceColor?: import("csstype").Property.MsScrollbarFaceColor | undefined;
	msScrollbarHighlightColor?: import("csstype").Property.MsScrollbarHighlightColor | undefined;
	msScrollbarShadowColor?: import("csstype").Property.MsScrollbarShadowColor | undefined;
	msScrollbarTrackColor?: import("csstype").Property.MsScrollbarTrackColor | undefined;
	msTextAutospace?: import("csstype").Property.MsTextAutospace | undefined;
	msTextCombineHorizontal?: import("csstype").Property.TextCombineUpright | undefined;
	msTextOverflow?: import("csstype").Property.TextOverflow | undefined;
	msTouchAction?: import("csstype").Property.TouchAction | undefined;
	msTouchSelect?: import("csstype").Property.MsTouchSelect | undefined;
	msTransform?: import("csstype").Property.Transform | undefined;
	msTransformOrigin?: import("csstype").Property.TransformOrigin<string | number> | undefined;
	msTransitionDelay?: import("csstype").Property.TransitionDelay<string & {}> | undefined;
	msTransitionDuration?: import("csstype").Property.TransitionDuration<string & {}> | undefined;
	msTransitionProperty?: import("csstype").Property.TransitionProperty | undefined;
	msTransitionTimingFunction?: import("csstype").Property.TransitionTimingFunction | undefined;
	msUserSelect?: import("csstype").Property.MsUserSelect | undefined;
	msWordBreak?: import("csstype").Property.WordBreak | undefined;
	msWrapFlow?: import("csstype").Property.MsWrapFlow | undefined;
	msWrapMargin?: import("csstype").Property.MsWrapMargin<string | number> | undefined;
	msWrapThrough?: import("csstype").Property.MsWrapThrough | undefined;
	msWritingMode?: import("csstype").Property.WritingMode | undefined;
	WebkitAlignContent?: import("csstype").Property.AlignContent | undefined;
	WebkitAlignItems?: import("csstype").Property.AlignItems | undefined;
	WebkitAlignSelf?: import("csstype").Property.AlignSelf | undefined;
	WebkitAnimationDelay?: import("csstype").Property.AnimationDelay<string & {}> | undefined;
	WebkitAnimationDirection?: import("csstype").Property.AnimationDirection | undefined;
	WebkitAnimationDuration?: import("csstype").Property.AnimationDuration<string & {}> | undefined;
	WebkitAnimationFillMode?: import("csstype").Property.AnimationFillMode | undefined;
	WebkitAnimationIterationCount?: import("csstype").Property.AnimationIterationCount | undefined;
	WebkitAnimationName?: import("csstype").Property.AnimationName | undefined;
	WebkitAnimationPlayState?: import("csstype").Property.AnimationPlayState | undefined;
	WebkitAnimationTimingFunction?: import("csstype").Property.AnimationTimingFunction | undefined;
	WebkitAppearance?: import("csstype").Property.WebkitAppearance | undefined;
	WebkitBackdropFilter?: import("csstype").Property.BackdropFilter | undefined;
	WebkitBackfaceVisibility?: import("csstype").Property.BackfaceVisibility | undefined;
	WebkitBackgroundClip?: import("csstype").Property.BackgroundClip | undefined;
	WebkitBackgroundOrigin?: import("csstype").Property.BackgroundOrigin | undefined;
	WebkitBackgroundSize?: import("csstype").Property.BackgroundSize<string | number> | undefined;
	WebkitBorderBeforeColor?: import("csstype").Property.WebkitBorderBeforeColor | undefined;
	WebkitBorderBeforeStyle?: import("csstype").Property.WebkitBorderBeforeStyle | undefined;
	WebkitBorderBeforeWidth?: import("csstype").Property.WebkitBorderBeforeWidth<string | number> | undefined;
	WebkitBorderBottomLeftRadius?: import("csstype").Property.BorderBottomLeftRadius<string | number> | undefined;
	WebkitBorderBottomRightRadius?: import("csstype").Property.BorderBottomRightRadius<string | number> | undefined;
	WebkitBorderImageSlice?: import("csstype").Property.BorderImageSlice | undefined;
	WebkitBorderTopLeftRadius?: import("csstype").Property.BorderTopLeftRadius<string | number> | undefined;
	WebkitBorderTopRightRadius?: import("csstype").Property.BorderTopRightRadius<string | number> | undefined;
	WebkitBoxDecorationBreak?: import("csstype").Property.BoxDecorationBreak | undefined;
	WebkitBoxReflect?: import("csstype").Property.WebkitBoxReflect<string | number> | undefined;
	WebkitBoxShadow?: import("csstype").Property.BoxShadow | undefined;
	WebkitBoxSizing?: import("csstype").Property.BoxSizing | undefined;
	WebkitClipPath?: import("csstype").Property.ClipPath | undefined;
	WebkitColumnCount?: import("csstype").Property.ColumnCount | undefined;
	WebkitColumnFill?: import("csstype").Property.ColumnFill | undefined;
	WebkitColumnRuleColor?: import("csstype").Property.ColumnRuleColor | undefined;
	WebkitColumnRuleStyle?: import("csstype").Property.ColumnRuleStyle | undefined;
	WebkitColumnRuleWidth?: import("csstype").Property.ColumnRuleWidth<string | number> | undefined;
	WebkitColumnSpan?: import("csstype").Property.ColumnSpan | undefined;
	WebkitColumnWidth?: import("csstype").Property.ColumnWidth<string | number> | undefined;
	WebkitFilter?: import("csstype").Property.Filter | undefined;
	WebkitFlexBasis?: import("csstype").Property.FlexBasis<string | number> | undefined;
	WebkitFlexDirection?: import("csstype").Property.FlexDirection | undefined;
	WebkitFlexGrow?: import("csstype").Property.FlexGrow | undefined;
	WebkitFlexShrink?: import("csstype").Property.FlexShrink | undefined;
	WebkitFlexWrap?: import("csstype").Property.FlexWrap | undefined;
	WebkitFontFeatureSettings?: import("csstype").Property.FontFeatureSettings | undefined;
	WebkitFontKerning?: import("csstype").Property.FontKerning | undefined;
	WebkitFontSmoothing?: import("csstype").Property.FontSmooth<string | number> | undefined;
	WebkitFontVariantLigatures?: import("csstype").Property.FontVariantLigatures | undefined;
	WebkitHyphenateCharacter?: import("csstype").Property.HyphenateCharacter | undefined;
	WebkitHyphens?: import("csstype").Property.Hyphens | undefined;
	WebkitInitialLetter?: import("csstype").Property.InitialLetter | undefined;
	WebkitJustifyContent?: import("csstype").Property.JustifyContent | undefined;
	WebkitLineBreak?: import("csstype").Property.LineBreak | undefined;
	WebkitLineClamp?: import("csstype").Property.WebkitLineClamp | undefined;
	WebkitLogicalHeight?: import("csstype").Property.BlockSize<string | number> | undefined;
	WebkitLogicalWidth?: import("csstype").Property.InlineSize<string | number> | undefined;
	WebkitMarginEnd?: import("csstype").Property.MarginInlineEnd<string | number> | undefined;
	WebkitMarginStart?: import("csstype").Property.MarginInlineStart<string | number> | undefined;
	WebkitMaskAttachment?: import("csstype").Property.WebkitMaskAttachment | undefined;
	WebkitMaskBoxImageOutset?: import("csstype").Property.MaskBorderOutset<string | number> | undefined;
	WebkitMaskBoxImageRepeat?: import("csstype").Property.MaskBorderRepeat | undefined;
	WebkitMaskBoxImageSlice?: import("csstype").Property.MaskBorderSlice | undefined;
	WebkitMaskBoxImageSource?: import("csstype").Property.MaskBorderSource | undefined;
	WebkitMaskBoxImageWidth?: import("csstype").Property.MaskBorderWidth<string | number> | undefined;
	WebkitMaskClip?: import("csstype").Property.WebkitMaskClip | undefined;
	WebkitMaskComposite?: import("csstype").Property.WebkitMaskComposite | undefined;
	WebkitMaskImage?: import("csstype").Property.WebkitMaskImage | undefined;
	WebkitMaskOrigin?: import("csstype").Property.WebkitMaskOrigin | undefined;
	WebkitMaskPosition?: import("csstype").Property.WebkitMaskPosition<string | number> | undefined;
	WebkitMaskPositionX?: import("csstype").Property.WebkitMaskPositionX<string | number> | undefined;
	WebkitMaskPositionY?: import("csstype").Property.WebkitMaskPositionY<string | number> | undefined;
	WebkitMaskRepeat?: import("csstype").Property.WebkitMaskRepeat | undefined;
	WebkitMaskRepeatX?: import("csstype").Property.WebkitMaskRepeatX | undefined;
	WebkitMaskRepeatY?: import("csstype").Property.WebkitMaskRepeatY | undefined;
	WebkitMaskSize?: import("csstype").Property.WebkitMaskSize<string | number> | undefined;
	WebkitMaxInlineSize?: import("csstype").Property.MaxInlineSize<string | number> | undefined;
	WebkitOrder?: import("csstype").Property.Order | undefined;
	WebkitOverflowScrolling?: import("csstype").Property.WebkitOverflowScrolling | undefined;
	WebkitPaddingEnd?: import("csstype").Property.PaddingInlineEnd<string | number> | undefined;
	WebkitPaddingStart?: import("csstype").Property.PaddingInlineStart<string | number> | undefined;
	WebkitPerspective?: import("csstype").Property.Perspective<string | number> | undefined;
	WebkitPerspectiveOrigin?: import("csstype").Property.PerspectiveOrigin<string | number> | undefined;
	WebkitPrintColorAdjust?: import("csstype").Property.PrintColorAdjust | undefined;
	WebkitRubyPosition?: import("csstype").Property.RubyPosition | undefined;
	WebkitScrollSnapType?: import("csstype").Property.ScrollSnapType | undefined;
	WebkitShapeMargin?: import("csstype").Property.ShapeMargin<string | number> | undefined;
	WebkitTapHighlightColor?: import("csstype").Property.WebkitTapHighlightColor | undefined;
	WebkitTextCombine?: import("csstype").Property.TextCombineUpright | undefined;
	WebkitTextDecorationColor?: import("csstype").Property.TextDecorationColor | undefined;
	WebkitTextDecorationLine?: import("csstype").Property.TextDecorationLine | undefined;
	WebkitTextDecorationSkip?: import("csstype").Property.TextDecorationSkip | undefined;
	WebkitTextDecorationStyle?: import("csstype").Property.TextDecorationStyle | undefined;
	WebkitTextEmphasisColor?: import("csstype").Property.TextEmphasisColor | undefined;
	WebkitTextEmphasisPosition?: import("csstype").Property.TextEmphasisPosition | undefined;
	WebkitTextEmphasisStyle?: import("csstype").Property.TextEmphasisStyle | undefined;
	WebkitTextFillColor?: import("csstype").Property.WebkitTextFillColor | undefined;
	WebkitTextOrientation?: import("csstype").Property.TextOrientation | undefined;
	WebkitTextSizeAdjust?: import("csstype").Property.TextSizeAdjust | undefined;
	WebkitTextStrokeColor?: import("csstype").Property.WebkitTextStrokeColor | undefined;
	WebkitTextStrokeWidth?: import("csstype").Property.WebkitTextStrokeWidth<string | number> | undefined;
	WebkitTextUnderlinePosition?: import("csstype").Property.TextUnderlinePosition | undefined;
	WebkitTouchCallout?: import("csstype").Property.WebkitTouchCallout | undefined;
	WebkitTransform?: import("csstype").Property.Transform | undefined;
	WebkitTransformOrigin?: import("csstype").Property.TransformOrigin<string | number> | undefined;
	WebkitTransformStyle?: import("csstype").Property.TransformStyle | undefined;
	WebkitTransitionDelay?: import("csstype").Property.TransitionDelay<string & {}> | undefined;
	WebkitTransitionDuration?: import("csstype").Property.TransitionDuration<string & {}> | undefined;
	WebkitTransitionProperty?: import("csstype").Property.TransitionProperty | undefined;
	WebkitTransitionTimingFunction?: import("csstype").Property.TransitionTimingFunction | undefined;
	WebkitUserModify?: import("csstype").Property.WebkitUserModify | undefined;
	WebkitUserSelect?: import("csstype").Property.WebkitUserSelect | undefined;
	WebkitWritingMode?: import("csstype").Property.WritingMode | undefined;
	MozAnimation?: import("csstype").Property.Animation<string & {}> | undefined;
	MozBorderImage?: import("csstype").Property.BorderImage | undefined;
	MozColumnRule?: import("csstype").Property.ColumnRule<string | number> | undefined;
	MozColumns?: import("csstype").Property.Columns<string | number> | undefined;
	MozOutlineRadius?: import("csstype").Property.MozOutlineRadius<string | number> | undefined;
	MozTransition?: import("csstype").Property.Transition<string & {}> | undefined;
	msContentZoomLimit?: import("csstype").Property.MsContentZoomLimit | undefined;
	msContentZoomSnap?: import("csstype").Property.MsContentZoomSnap | undefined;
	msFlex?: import("csstype").Property.Flex<string | number> | undefined;
	msScrollLimit?: import("csstype").Property.MsScrollLimit | undefined;
	msScrollSnapX?: import("csstype").Property.MsScrollSnapX | undefined;
	msScrollSnapY?: import("csstype").Property.MsScrollSnapY | undefined;
	msTransition?: import("csstype").Property.Transition<string & {}> | undefined;
	WebkitAnimation?: import("csstype").Property.Animation<string & {}> | undefined;
	WebkitBorderBefore?: import("csstype").Property.WebkitBorderBefore<string | number> | undefined;
	WebkitBorderImage?: import("csstype").Property.BorderImage | undefined;
	WebkitBorderRadius?: import("csstype").Property.BorderRadius<string | number> | undefined;
	WebkitColumnRule?: import("csstype").Property.ColumnRule<string | number> | undefined;
	WebkitColumns?: import("csstype").Property.Columns<string | number> | undefined;
	WebkitFlex?: import("csstype").Property.Flex<string | number> | undefined;
	WebkitFlexFlow?: import("csstype").Property.FlexFlow | undefined;
	WebkitMask?: import("csstype").Property.WebkitMask<string | number> | undefined;
	WebkitMaskBoxImage?: import("csstype").Property.MaskBorder | undefined;
	WebkitTextEmphasis?: import("csstype").Property.TextEmphasis | undefined;
	WebkitTextStroke?: import("csstype").Property.WebkitTextStroke<string | number> | undefined;
	WebkitTransition?: import("csstype").Property.Transition<string & {}> | undefined;
	boxAlign?: import("csstype").Property.BoxAlign | undefined;
	boxDirection?: import("csstype").Property.BoxDirection | undefined;
	boxFlex?: import("csstype").Property.BoxFlex | undefined;
	boxFlexGroup?: import("csstype").Property.BoxFlexGroup | undefined;
	boxLines?: import("csstype").Property.BoxLines | undefined;
	boxOrdinalGroup?: import("csstype").Property.BoxOrdinalGroup | undefined;
	boxOrient?: import("csstype").Property.BoxOrient | undefined;
	boxPack?: import("csstype").Property.BoxPack | undefined;
	clip?: import("csstype").Property.Clip | undefined;
	fontStretch?: import("csstype").Property.FontStretch | undefined;
	gridColumnGap?: import("csstype").Property.GridColumnGap<string | number> | undefined;
	gridGap?: import("csstype").Property.GridGap<string | number> | undefined;
	gridRowGap?: import("csstype").Property.GridRowGap<string | number> | undefined;
	imeMode?: import("csstype").Property.ImeMode | undefined;
	insetArea?: import("csstype").Property.PositionArea | undefined;
	offsetBlock?: import("csstype").Property.InsetBlock<string | number> | undefined;
	offsetBlockEnd?: import("csstype").Property.InsetBlockEnd<string | number> | undefined;
	offsetBlockStart?: import("csstype").Property.InsetBlockStart<string | number> | undefined;
	offsetInline?: import("csstype").Property.InsetInline<string | number> | undefined;
	offsetInlineEnd?: import("csstype").Property.InsetInlineEnd<string | number> | undefined;
	offsetInlineStart?: import("csstype").Property.InsetInlineStart<string | number> | undefined;
	pageBreakAfter?: import("csstype").Property.PageBreakAfter | undefined;
	pageBreakBefore?: import("csstype").Property.PageBreakBefore | undefined;
	pageBreakInside?: import("csstype").Property.PageBreakInside | undefined;
	positionTryOptions?: import("csstype").Property.PositionTryFallbacks | undefined;
	scrollSnapCoordinate?: import("csstype").Property.ScrollSnapCoordinate<string | number> | undefined;
	scrollSnapDestination?: import("csstype").Property.ScrollSnapDestination<string | number> | undefined;
	scrollSnapPointsX?: import("csstype").Property.ScrollSnapPointsX | undefined;
	scrollSnapPointsY?: import("csstype").Property.ScrollSnapPointsY | undefined;
	scrollSnapTypeX?: import("csstype").Property.ScrollSnapTypeX | undefined;
	scrollSnapTypeY?: import("csstype").Property.ScrollSnapTypeY | undefined;
	KhtmlBoxAlign?: import("csstype").Property.BoxAlign | undefined;
	KhtmlBoxDirection?: import("csstype").Property.BoxDirection | undefined;
	KhtmlBoxFlex?: import("csstype").Property.BoxFlex | undefined;
	KhtmlBoxFlexGroup?: import("csstype").Property.BoxFlexGroup | undefined;
	KhtmlBoxLines?: import("csstype").Property.BoxLines | undefined;
	KhtmlBoxOrdinalGroup?: import("csstype").Property.BoxOrdinalGroup | undefined;
	KhtmlBoxOrient?: import("csstype").Property.BoxOrient | undefined;
	KhtmlBoxPack?: import("csstype").Property.BoxPack | undefined;
	KhtmlLineBreak?: import("csstype").Property.LineBreak | undefined;
	KhtmlOpacity?: import("csstype").Property.Opacity | undefined;
	KhtmlUserSelect?: import("csstype").Property.UserSelect | undefined;
	MozBackgroundClip?: import("csstype").Property.BackgroundClip | undefined;
	MozBackgroundOrigin?: import("csstype").Property.BackgroundOrigin | undefined;
	MozBackgroundSize?: import("csstype").Property.BackgroundSize<string | number> | undefined;
	MozBorderRadius?: import("csstype").Property.BorderRadius<string | number> | undefined;
	MozBorderRadiusBottomleft?: import("csstype").Property.BorderBottomLeftRadius<string | number> | undefined;
	MozBorderRadiusBottomright?: import("csstype").Property.BorderBottomRightRadius<string | number> | undefined;
	MozBorderRadiusTopleft?: import("csstype").Property.BorderTopLeftRadius<string | number> | undefined;
	MozBorderRadiusTopright?: import("csstype").Property.BorderTopRightRadius<string | number> | undefined;
	MozBoxAlign?: import("csstype").Property.BoxAlign | undefined;
	MozBoxDirection?: import("csstype").Property.BoxDirection | undefined;
	MozBoxFlex?: import("csstype").Property.BoxFlex | undefined;
	MozBoxOrdinalGroup?: import("csstype").Property.BoxOrdinalGroup | undefined;
	MozBoxOrient?: import("csstype").Property.BoxOrient | undefined;
	MozBoxPack?: import("csstype").Property.BoxPack | undefined;
	MozBoxShadow?: import("csstype").Property.BoxShadow | undefined;
	MozColumnCount?: import("csstype").Property.ColumnCount | undefined;
	MozColumnFill?: import("csstype").Property.ColumnFill | undefined;
	MozFloatEdge?: import("csstype").Property.MozFloatEdge | undefined;
	MozForceBrokenImageIcon?: import("csstype").Property.MozForceBrokenImageIcon | undefined;
	MozOpacity?: import("csstype").Property.Opacity | undefined;
	MozOutline?: import("csstype").Property.Outline<string | number> | undefined;
	MozOutlineColor?: import("csstype").Property.OutlineColor | undefined;
	MozOutlineStyle?: import("csstype").Property.OutlineStyle | undefined;
	MozOutlineWidth?: import("csstype").Property.OutlineWidth<string | number> | undefined;
	MozTextAlignLast?: import("csstype").Property.TextAlignLast | undefined;
	MozTextDecorationColor?: import("csstype").Property.TextDecorationColor | undefined;
	MozTextDecorationLine?: import("csstype").Property.TextDecorationLine | undefined;
	MozTextDecorationStyle?: import("csstype").Property.TextDecorationStyle | undefined;
	MozTransitionDelay?: import("csstype").Property.TransitionDelay<string & {}> | undefined;
	MozTransitionDuration?: import("csstype").Property.TransitionDuration<string & {}> | undefined;
	MozTransitionProperty?: import("csstype").Property.TransitionProperty | undefined;
	MozTransitionTimingFunction?: import("csstype").Property.TransitionTimingFunction | undefined;
	MozUserFocus?: import("csstype").Property.MozUserFocus | undefined;
	MozUserInput?: import("csstype").Property.MozUserInput | undefined;
	msImeMode?: import("csstype").Property.ImeMode | undefined;
	OAnimation?: import("csstype").Property.Animation<string & {}> | undefined;
	OAnimationDelay?: import("csstype").Property.AnimationDelay<string & {}> | undefined;
	OAnimationDirection?: import("csstype").Property.AnimationDirection | undefined;
	OAnimationDuration?: import("csstype").Property.AnimationDuration<string & {}> | undefined;
	OAnimationFillMode?: import("csstype").Property.AnimationFillMode | undefined;
	OAnimationIterationCount?: import("csstype").Property.AnimationIterationCount | undefined;
	OAnimationName?: import("csstype").Property.AnimationName | undefined;
	OAnimationPlayState?: import("csstype").Property.AnimationPlayState | undefined;
	OAnimationTimingFunction?: import("csstype").Property.AnimationTimingFunction | undefined;
	OBackgroundSize?: import("csstype").Property.BackgroundSize<string | number> | undefined;
	OBorderImage?: import("csstype").Property.BorderImage | undefined;
	OObjectFit?: import("csstype").Property.ObjectFit | undefined;
	OObjectPosition?: import("csstype").Property.ObjectPosition<string | number> | undefined;
	OTabSize?: import("csstype").Property.TabSize<string | number> | undefined;
	OTextOverflow?: import("csstype").Property.TextOverflow | undefined;
	OTransform?: import("csstype").Property.Transform | undefined;
	OTransformOrigin?: import("csstype").Property.TransformOrigin<string | number> | undefined;
	OTransition?: import("csstype").Property.Transition<string & {}> | undefined;
	OTransitionDelay?: import("csstype").Property.TransitionDelay<string & {}> | undefined;
	OTransitionDuration?: import("csstype").Property.TransitionDuration<string & {}> | undefined;
	OTransitionProperty?: import("csstype").Property.TransitionProperty | undefined;
	OTransitionTimingFunction?: import("csstype").Property.TransitionTimingFunction | undefined;
	WebkitBoxAlign?: import("csstype").Property.BoxAlign | undefined;
	WebkitBoxDirection?: import("csstype").Property.BoxDirection | undefined;
	WebkitBoxFlex?: import("csstype").Property.BoxFlex | undefined;
	WebkitBoxFlexGroup?: import("csstype").Property.BoxFlexGroup | undefined;
	WebkitBoxLines?: import("csstype").Property.BoxLines | undefined;
	WebkitBoxOrdinalGroup?: import("csstype").Property.BoxOrdinalGroup | undefined;
	WebkitBoxOrient?: import("csstype").Property.BoxOrient | undefined;
	WebkitBoxPack?: import("csstype").Property.BoxPack | undefined;
	colorInterpolation?: import("csstype").Property.ColorInterpolation | undefined;
	colorRendering?: import("csstype").Property.ColorRendering | undefined;
	glyphOrientationVertical?: import("csstype").Property.GlyphOrientationVertical | undefined;
};
export declare const monospace: StyleElement;
export declare const text: (size: TextSize, fontWeight: TextWeight, color: TextColor) => StyleElement;
export declare const avatar: {
	readonly green: VariableGroup<{
		readonly background: {
			readonly default: "hsl(160, 45%, 90%)";
			readonly ":root[data-theme=\"dark\"]": "hsl(160, 35%, 22%)";
		};
		readonly foreground: {
			readonly default: "hsl(160, 65%, 28%)";
			readonly ":root[data-theme=\"dark\"]": "hsl(160, 60%, 78%)";
		};
	}>;
	readonly orange: VariableGroup<{
		readonly background: {
			readonly default: "hsl(24, 70%, 91%)";
			readonly ":root[data-theme=\"dark\"]": "hsl(24, 40%, 22%)";
		};
		readonly foreground: {
			readonly default: "hsl(24, 75%, 35%)";
			readonly ":root[data-theme=\"dark\"]": "hsl(24, 80%, 78%)";
		};
	}>;
	readonly pink: VariableGroup<{
		readonly background: {
			readonly default: "hsl(320, 55%, 92%)";
			readonly ":root[data-theme=\"dark\"]": "hsl(320, 30%, 22%)";
		};
		readonly foreground: {
			readonly default: "hsl(320, 55%, 38%)";
			readonly ":root[data-theme=\"dark\"]": "hsl(320, 70%, 80%)";
		};
	}>;
};
/** Maui standard interactive transition timing. */
export declare const motionDurationMs = 80;
/** Entrance duration for streaming token reveals (Streamdown word fade). */
export declare const motionStreamDurationMs = 80;
export declare const motionEasing = "ease-in-out";
export declare const motion: {
	readonly standard: (...args: string[]) => StyleElement;
};
/** Same t-shirt scale as `text(...)` and `Icons.* size`. */
export type IconSize = TextSize;
/**
 * Icon box sizes paired with text sizes. Values sit slightly above the
 * matching font-size so stroke icons balance optically next to type.
 * Intrinsic SVG artwork is 24×24 (`xl`). Applied by `Icons.*` via `size`.
 */
export declare const iconSizeValues: Record<IconSize, string>;
declare const sizingTokens: {
	readonly fullWidth: StyleElement;
	readonly contentWidth: StyleElement;
};
/**
 * Long-form/reading type scale. Distinct from the `text` token group (which
 * sizes application UI): prose runs larger, with line-heights and vertical
 * rhythm tuned for sustained reading. The `Prose` container picks a size and
 * typography components inside it opt into the matching prose treatment.
 *
 * Sizes and spacing are ported from the Tailwind Typography plugin
 * (https://github.com/tailwindlabs/tailwindcss-typography): `sm` -> 14px base,
 * `md` -> Tailwind's `base` (16px), `lg` -> 18px. Tailwind's em-relative values
 * are resolved to px here so they compose with Maui's px-based tokens.
 */
export type ProseSize = "sm" | "md" | "lg";
export declare const prose: (size: ProseSize) => {
	paragraph: StyleElement;
	h1: StyleElement;
	h2: StyleElement;
	h3: StyleElement;
	h4: StyleElement;
	link: StyleElement;
	blockquote: StyleElement;
	list: StyleElement;
};
/**
 * Vertical rhythm for the `Prose` container at a given size. Uses a
 * margin-top-only model (the gap between two blocks is the second block's
 * top margin), so there are no collapsing margins to reason about. Heading
 * `marginBottom` becomes the "hug" gap after a heading; heading `marginTop`
 * becomes the larger break before it.
 */
export declare const proseRhythm: (size: ProseSize) => StyleElement;
/**
 * Element styles + vertical rhythm for HTML rendered outside React typography
 * components (TipTap's ProseMirror tree, Streamdown markdown output).
 *
 * Uses a flex column + `gap` stack so spacing doesn't depend on fragile
 * adjacent-sibling matching across Streamdown's memoized blocks.
 */
export declare const proseHtml: (size: ProseSize) => StyleElement;
/** Fade list markers in with Streamdown word animation while streaming. */
export declare const proseStreamingMarkers: StyleElement;
export declare const visuallyHidden: StyleElement;
export type AvatarProps = {
	name: string;
	size?: TextSize;
	className?: string;
};
export declare function Avatar({ name, size, className }: AvatarProps): React$1.JSX.Element;
export type BadgeProps = React$1.HTMLAttributes<HTMLSpanElement>;
export declare function Badge({ className, children, ...props }: BadgeProps): React$1.JSX.Element;
export type ButtonVariant = "default" | "quiet" | "primary";
/** Opaque hex or `rgb()`. Palette names stay ColorName (`"blue"` is Radix, not CSS `blue`). */
export type ButtonCssColor = `#${string}` | `rgb(${string}`;
export type ButtonVariantColor = ColorName | ButtonCssColor;
export type ButtonAttributes = React$1.DetailedHTMLProps<React$1.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
export type ButtonData = {
	id: string;
	focused: boolean;
};
export type ButtonProps = Omit<ButtonAttributes, "children" | "ref"> & {
	children: React$1.ReactNode;
	variant?: ButtonVariant;
	variantColor?: ButtonVariantColor;
};
export declare function useButton(props: ButtonProps): [
	ButtonData,
	ButtonAttributes
];
export declare function Button(props: ButtonProps): React$1.JSX.Element;
export type CheckboxProps = {
	label?: string;
	checked: boolean;
	setChecked: (checked: boolean) => void;
};
export declare function Checkbox(props: CheckboxProps): React$1.JSX.Element;
export type SliderProps = AriaSliderProps<number> & {
	label: string;
};
export declare function Slider(props: SliderProps): React$1.JSX.Element;
export type RadioOptionGroupProps = AriaRadioGroupProps & {
	label: string;
	children: React$1.ReactNode;
};
export declare function RadioOptionGroup(props: RadioOptionGroupProps): React$1.JSX.Element;
export type RadioOptionProps = {
	value: string;
	children: React$1.ReactNode;
};
export declare function RadioOption(props: RadioOptionProps): React$1.JSX.Element;
export type InputProps = AriaTextFieldOptions<"input">;
export declare function TextField(props: InputProps): React$1.JSX.Element;
export declare function SearchField(props: AriaSearchFieldProps): React$1.JSX.Element;
export declare function NumberField(props: AriaNumberFieldProps): React$1.JSX.Element;
export declare function QuietTextField(props: InputProps): React$1.JSX.Element;
export interface ListBoxProps<T> extends Omit<AriaListBoxProps<T>, "className"> {
}
export declare function ListBox<T>(props: ListBoxProps<T>): React$1.JSX.Element;
export interface ListBoxItemProps<T = object> extends Omit<AriaListBoxItemProps<T>, "className"> {
}
export declare function ListBoxItem<T extends object = object>(props: ListBoxItemProps<T>): React$1.JSX.Element;
export interface SelectProps<T, M extends "single" | "multiple" = "single"> extends Omit<AriaSelectProps<T, M>, "children" | "className"> {
	label?: string;
	description?: string;
	errorMessage?: string | ((validation: ValidationResult) => string);
	items?: Iterable<T>;
	children: React$1.ReactNode | ((item: T) => React$1.ReactNode);
}
export declare function Select<T, M extends "single" | "multiple" = "single">({ label, description, errorMessage, items, children, ...props }: SelectProps<T, M>): React$1.JSX.Element;
export type SelectItemProps<T = object> = ListBoxItemProps<T>;
export declare const SelectItem: typeof ListBoxItem;
export type DialogProps = {
	children?: React$1.ReactNode;
	onClickOutside?: () => void;
};
export declare function Dialog(props: DialogProps): React$1.JSX.Element;
export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipProps = {
	/** The content shown inside the tooltip. */
	content: React$1.ReactNode;
	/** The trigger element. Must contain something focusable (e.g. a button). */
	children: React$1.ReactNode;
	placement?: TooltipPlacement;
	/** Warmup delay in ms before the tooltip shows on hover. */
	delay?: number;
	isDisabled?: boolean;
};
export declare function Tooltip(props: TooltipProps): React$1.JSX.Element;
export declare function Overlay(props: {
	children: React$1.ReactNode;
	onClickOutside?: () => void;
}): React$1.ReactPortal;
export type PanelProps = React$1.ComponentPropsWithoutRef<"div">;
export declare function Panel({ className, children, ...props }: PanelProps): React$1.JSX.Element;
export declare function Table(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function TableHead(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function TableBody(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function TableRow(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function TableHeaderCell(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function TableCell(props: {
	children: React$1.ReactNode;
	align?: "top" | "middle";
}): React$1.JSX.Element;
/**
 * Returns the current prose size, or `null` when rendered outside a `Prose`
 * container. Typography components use this to decide between prose and
 * application type treatments.
 */
export declare function useProseSize(): ProseSize | null;
/**
 * Vertical rhythm for long-form/docs content (headings, paragraphs, and the
 * demo panels between them). Typography components carry no margin of their
 * own, so this is the one place spacing between them is defined - as a
 * property of this container, not of the elements passing through it.
 *
 * `size` selects the prose type scale that descendant typography components
 * inherit via context.
 */
export declare function Prose(props: {
	children: React$1.ReactNode;
	size?: ProseSize;
	className?: string;
	style?: React$1.CSSProperties;
}): React$1.JSX.Element;
export declare const proseMaxWidth = "72ch";
export type EditorProps = {
	/** Markdown content. Updates are applied when this value changes. */
	content?: string;
	/** Called with the current markdown whenever the document changes. */
	onChange?: (markdown: string) => void;
	placeholder?: string;
	size?: ProseSize;
	editable?: boolean;
	className?: string;
	"aria-label"?: string;
	onSubmit?: () => void;
};
/**
 * TipTap markdown surface with CommonMark shortcuts (`#`, `**`, `-`, `>`, …)
 * and Maui prose type styles on the ProseMirror tree. No chrome — wrap it
 * for padding, elevation, and actions.
 */
export declare function Editor({ content, onChange, placeholder, size, editable, className, "aria-label": ariaLabel, onSubmit, }: EditorProps): React$1.JSX.Element;
export type ThinkingVariant = "primary" | "accent" | "muted";
export type ThinkingProps = {
	size?: string;
	variant?: ThinkingVariant;
	className?: string;
	"aria-label"?: string;
};
/**
 * A 3x3 dot grid, text-sized, that simulates Conway's Game of Life starting
 * from a random orientation. A small grid dies out or freezes quickly, so
 * whenever the simulation goes extinct or repeats a recent state, it reseeds
 * with a fresh random pattern to keep animating.
 */
export declare function Thinking({ size, variant, className, "aria-label": ariaLabel, }: ThinkingProps): React$1.JSX.Element;
export type IconProps = React$1.SVGProps<SVGSVGElement> & {
	size?: IconSize;
};
export declare const CircleX: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mail: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon12hrClock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon16Plus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon18Plus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon24hrClock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon2mDistance: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon3dRectangle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon3dRotate: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon4g: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon4k: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon5g: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Icon90Degrees: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AZSort: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Accessibility: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Acorn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Activity: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AddVideo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Aerial: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Aerosol: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AiBot: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AiDocument: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AiImage2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AiImage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AiText: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ai: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AirTrafficControl: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AirplayToTv: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AirpodsCase: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Airpods: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlarmWarning: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Alarm: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Alert: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Alien2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Alien: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignArrowDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignArrowLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignArrowRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignBottom: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignCentreHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignCentreVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignHorizontalCenter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignTop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AlignVerticalCenter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AltKey: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Anchor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Angle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AnimationEnter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AnimationExit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AnnotationDots: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AnnotationWarning: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Annotation: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Announcement: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AppStore: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Apple2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ApplePay: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AppleWatchUltra: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AppleWatch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Apple: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Apps: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Aquarius: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArCubeDashedBorder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArcheryArrow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArchiveArrowDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArchiveArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArchiveCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArchiveMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArchivePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArchiveStack: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Archive: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Aries: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Armchair: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowBottomLeftCorner: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowBottomLeftSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowBottomRightCorner: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowBottomRightSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownInCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownLeftCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownPercentage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownRightCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDownRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowLeftCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowRightCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowTopLeftCorner: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowTopLeftSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowTopRightCorner: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowTopRightSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpInCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpLeftCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpPercentage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpRightCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUpRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Arrows: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AspectRatio: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Asterisk: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Astronomy: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AtSign: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AvatarCheckSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AvatarHexagonal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const AvatarSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Award: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Axe: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Axes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Back: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Backpack: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bacteria: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Badge2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Badge$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Baguette: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Baht: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BalanceSheet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BallRollingFast: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BallRolling: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ball: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Balloon: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Balloons: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BallotBox: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ballot: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Banana: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BandAid: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bandages: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BankNote: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bank: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Barcode2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Barcode: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BaseballHelmet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Baseball: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bath: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BatteryCharging: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BatteryError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BatteryFull: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BatteryLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BatteryMedium: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Battery: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bbq: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Beach2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Beach: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Beer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BellCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BellCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BellOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BellRinging: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BellSnooze: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bell: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BezierControlPoints: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BezierCurve2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BezierCurve: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BezierPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bezier: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bicycle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Binary: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Binoculars: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bird2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BirdHouse: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bird: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bitcoin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BlindsClosed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BlindsOpen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BlockInside: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BlockOutside: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Blockquote: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bluetooth: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Boat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bold: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BoltAuto: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bolt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bonfire: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Book2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BookOpen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Book: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bookmark2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bookmark: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Books: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderBottom: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderCentre: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderRadiusBottomLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderRadiusBottomRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderRadiusTopLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderRadiusTopRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BorderTop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Borders: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bottle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BottomLeftDottedSquares: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BottomRightDottedSquares: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BounceLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BounceRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bowl: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bowling: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BoxCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BoxCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BoxSparkle2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BoxSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Box: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Boxes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BracesWithDots: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Braces: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Brain: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bread: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrickWall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bridge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Briefcase2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BriefcaseCheckmark: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BriefcaseCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Briefcase: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrightnessHigh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrightnessLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrightnessMedium: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BringForward: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Broadcast: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BroomSparkles: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrowserCursor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrowserError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrowserHistory: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrowserSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BrowserTabs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Browser: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bug2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bug: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Building01: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Building2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BuildingMonument: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BuildingStore: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Building: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Buildings3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Buildings: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BulbCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const BulbCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bunting2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bunting: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Burger: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Bus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Butterfly: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cabinet2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cabinet3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cabinet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CableCar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cactus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CakeSlice: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cake: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Calculator2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Calculator: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CalendarCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CalendarCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CalendarMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CalendarPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CalendarTimer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Calendar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraError2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraGrid: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraTripod: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CameraX: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Camera: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cancer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Candle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CandlestickChart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Capricorn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Captions: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Car2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CarBattery: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CarDashboard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CarDoor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CarEngine: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CarGearStick: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Car: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CaratDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CaratLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CaratRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CaratUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CardHolder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cards2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cards: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cassette: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CatPaw: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cctv: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Celsius: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cent: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Center: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Chart2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Chart3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChartDecrease: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChartIncrease: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChartLeftArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChartMiddleArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChartRightArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Chart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Check2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CheckCircle2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CheckCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Check: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Checklist2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Checklist: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CheckmarkCards: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Checkmark: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cheese: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChefsHat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChemicalBottle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChemicalTube2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChemicalTube: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cherry: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronDownLarge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronDownSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronLeftLarge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronLeftSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronRightLarge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronRightSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronTriangleDownSmall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronTriangleLeftSmall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronTriangleRightSmall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronTriangleUpSmall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronUpLarge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronUpSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChevronUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Chicken: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Chilli: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ChristmasTree: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CircleDotted: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CircleIntersect: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CircleLeftHalfFull: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CircleMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CirclePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CircleTwoPoints: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Circle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Citrus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CleanPower: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Clean: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ClickPulse: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ClickableArea: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Clipboard$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ClockDottedLine: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Clock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ClockwiseRefreshStrikethrough: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CloseCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Close: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ClosedCaptionsOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ClosedCaptions: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Closet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CloudOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cloud: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Clubs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CoatHanger: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cocktail: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Code2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Code3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Code: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CoffeeMachine: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Coffee: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Coffin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cog: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CoinsMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CoinsPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Coins: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ColorSwatch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Columns2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ColumnsHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ColumnsVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Columns: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Command: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CommentCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CommentLove: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Compass: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Components: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cone2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cone3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Construction: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Contacts: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Contract: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Contrast: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cookie: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Copy: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CornerFlag: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cpu: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CrackedEgg: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CreditCardCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CreditCardLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CreditCardPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CreditCard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crosshair2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crosshair: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crowd: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crown2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CrownGlow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Crucifix: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Css: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CubeShape: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CupStraw: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CursorBlocked: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CursorClick: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CursorDottedLine: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CursorList: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CursorSpinner: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const CursorText: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cursor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Cylinder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dashboard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DataTransferCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DataTransferError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const DataTransfer$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DatabaseCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DatabaseCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DatabaseError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DatabaseMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DatabasePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Database: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Deathstar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Deer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Delete: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Devices2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Devices: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DialPad: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Diamond: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Diamonds: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dice1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dice2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dice3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dice4: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dice5: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dice6: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DiceCube: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dimensions: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Directions: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DirectorChair: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Disability2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Disability: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Discord: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dna2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dna: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoNotDisturb: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Doc: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DocumentShield: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DocumentSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dog2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dog: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dogecoin2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dogecoin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dollar2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dollar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoorEnter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoorExit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoorLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoorOpen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Door: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotGridVertical1x3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotGridVertical2x3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotGridVertical3x3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotsHorizontalCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotsHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotsVerticalCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DotsVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dots: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DottedCircleLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DottedCircleRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleBed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleChatBubble: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleChevronDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleChevronLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleChevronRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleChevronUpDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DoubleChevronUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DownloadCloud: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Download: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Downstairs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dress: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dribbble: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Drill: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Drink: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Drone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dropbox: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dropdown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const DropletOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Droplet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Droplets: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Drums2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Drums: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Dumbell: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EarOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ear: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EaseInControl: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EaseOutControl: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const East: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EditShape: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Edit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Education: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EggTimer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ElectricBike: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ElectricScooter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Elevator: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmailError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmailMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmailPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiAngry: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiHappy: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiNeutral: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiSad: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EmojiXEyes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EnterKey: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Eraser: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EscKey: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EscalatorDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EscalatorUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ethereum: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Euro: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Export: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyeClosed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyeDashedBorder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyeDropper: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyeLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyeMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyeOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const EyePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Eye: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceAngel: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceBigSmile2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceBigSmile: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceCry: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceIdError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceId: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceLaughing: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceLove: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceSad2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceSad: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceShock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceSmile: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceStraight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceSweat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceUpsideDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceWhistle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FaceYawn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Face: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Facebook: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fahrenheit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fan2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FastForward: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FastTrain: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Faucet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Feather: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Female2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Female: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Figma: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const File2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileCheckmark: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileCode: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileDownload2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileImportant: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileMinus2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FilePlus2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FilePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileScan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileSearch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileShare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileText2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileText: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FileUser: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const File$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Files: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Film: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Filter2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Filter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Filters2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Filters: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Finder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FingerCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FingerHeart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FingerPoint: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FingerSwipe: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FingerTap2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FingerTap: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fingernail: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fingerprint2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fingerprint: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fire: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fish: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fishes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlagPriority2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlagPriority3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlagPriority: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Flag: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Flashlight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlipHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlipHorizontally: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlipVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FlipVertically: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FloatCenter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FloatLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FloatRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Floorplan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FloppyDisc: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Flower2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Flower: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Flowers: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderImportant: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderOpen2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderOpenCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderOpenSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderOpen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderPerson: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderSearch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderShare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderStar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FolderZip: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Folder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FontFamily: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FontSize: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FoodCan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Forbid2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Forbid: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fork2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fork: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Forward: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FountainPen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Frame2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Frame: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Framer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FryingPan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Fullscreen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const FxOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GalleryHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GalleryVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GalleryView: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GamePad: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gaming: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Garage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GardenHose: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gauge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gavel: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gbp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gemini: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GenerateAi: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ghost: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gif: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gift: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GitBranch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GitCommit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GitDiff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GitFork: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GitMerge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GitPullRequest: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Github: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GivingMoney: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Giving: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GlassSpill: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GlobeLeaf: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Globe: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gmail: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GoldenGateBridge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GolfBall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Golf: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GoogleDrive: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Google: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gpt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gradient: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Grapes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gravestone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Grid2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Grid3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GridMasonry2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const GridMasonry: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Grid: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Guitar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Gun: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const H1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const H2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const H3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HairClippers: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HairPin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hairdryer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HalfCircleBottom: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HalfCircleTop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hammer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HandHome: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HandImportant: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HandLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HandMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HandPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HandSlash: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hand: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Handshake: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HardDrive2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HardDriveStorage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HardDrive: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hashtag: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hd: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeadToHead: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Heading: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Headphones2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Headphones3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Headphones: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Headset: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Health: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeartLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeartMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeartPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeartRate: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeartSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HeartStrikethrough: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Heart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hearts: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Height: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Helicopter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HelpCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Help: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hexagon: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HideKeyboard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Highlighter2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Highlighter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Home2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HomeWifi: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Home: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hook: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hourglass: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Hubspot: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HumidityHigh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HumidityLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const HumiditySensor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IceCream2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IceCream: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ice: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IdCard2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IdCard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ImageAvatarSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ImageLoadingSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ImageRotateLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ImageRotateRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Inbox: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Incognito: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IndentLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IndentRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Infinity$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Information: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ingredients: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const InputCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const InputCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const InputCursor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const InputField: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const InsertColumn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const InsertRow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Instagram: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Iphone2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Iphone3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IphoneDualCamera: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const IphoneProCamera: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Iphone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Iron: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Italic: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Jetski: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Journal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Jpg: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const KanbanPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Kanban: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Kerning: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Kettle2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Kettle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const KeySquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Key: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Keyboard2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Keyboard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Keyhole: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Keys: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Kiosk: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Knife2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Knife: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ladder2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ladder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LampCeiling: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Lamp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LandscapeExpand: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Landscape: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Language2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Language: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Languages: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Laptop2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LaptopAndPhone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LaptopCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LaptopError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Laptop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Lasso: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Lawnmower: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Layer1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Layer2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Layer3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayerMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayerPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayersDownArrow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayersUpArrow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Layers: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayoutBottom: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayoutLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayoutRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LayoutTop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Leaderboard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Leaf2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Leaf3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Leaf: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Lego: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Leo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LetterACircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LetterBCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LetterCCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LetterSpacing: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Libra: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LifeJacket: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LightBulb: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LightCeiling: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LightOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LightSwitch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Lightning: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LineHeight2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LineHeight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LinkBreak: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Link: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Linked: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Linkedin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Livestream: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Loading: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Location$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LockBorder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LockUnlocked: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Lock$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LogIn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LogOut: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Love: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const LuggageCarousel: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Lungs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MagicHat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MagicMouse: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MagicWand: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MagnetBolt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Magnet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MailOpenAttachment: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MailOpenCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MailOpenSparkles: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MailOpenTick: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MailOpen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mailbox: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Male2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Male: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Map2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MapPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Map$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mask2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mask: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Maximize2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Maximize: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Medical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Menu2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Menu: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Merge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Message: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MicError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MicMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MicPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Microchip: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Microphone2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MicrophoneMute: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Microphone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Microscope: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Microwave: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Milk: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MiniFridge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Minimize2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Minimize: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MinusCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Minus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mirror2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MirrorHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mirror: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MoneyBag: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Money: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Monitor2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Monitor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Moon2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Moon: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MotionSensor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mountain: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mouse: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Move: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mug2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mug3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Mug: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MultipleFolders: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MusicNoteSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const MusicNote: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Music: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Navigation: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Needle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Network: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NewHire: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NewWindow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NewWithLines: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const New: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Newspaper: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NintendoSwitch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoAvatarSquare: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoAvatar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoBluetooth: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoBugs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoLocation: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoParking: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoPin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoSmoking: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoWeed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Nordvpn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const North: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NoseBleed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Nose: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Notebook: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Nuclear: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const NumberedList: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Nut: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Octagon: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const OneFinger: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Onion: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const OpenPane: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Option$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Orbit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const OrderedList: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Package: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Padding: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PageFlip: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paintbrush2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paintbrush3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paintbrush: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paintbucket2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paintbucket3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paintbucket: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Panoramic: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Paperclip: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Parenthesis: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Parking: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Party: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Passport: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Password: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pause: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pawn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pdf: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Peace: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PenSparkles: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PenTool2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PenTool: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pencil2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PencilBook: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PencilInCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PencilWifi: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pencil: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const People: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pepper: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Percentage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PeriodicTable: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonHeart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonLaptopBubble: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonLaptop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonSauna: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonSpeechBubble: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonWalkingStick: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonWalking: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PersonWithLuggage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Person: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Petrol: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pharmacy: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCallCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCallForward: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCallHangUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCallIncoming: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCallOutgoing: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCall: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhoneSignal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Phone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoFilm: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoFrame: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoHide: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoLens: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PhotoPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Photo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Photoshop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PianoKeys: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PictureInPicture: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PieChart3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PieChart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Piggybank: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pill2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pill: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pills: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PinCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PinOnMap: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PinTack2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PinTack3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PinTack: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pipe: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pisces: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pizza2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pizza: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Plane2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlaneLanding: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlaneTakeOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Plane: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Planet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Play: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlugIn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlugOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlugOn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Plug: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlusCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PlusMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Plus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Png: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pokeball: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Polaroids: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Poll: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Polywork: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Poo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Popcorn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PortraitExpand: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Portrait: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pot2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pot: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PowerPlant: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Power: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pram: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Presentation: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Press: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Print: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const PrivateWifi: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Projector2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Projector: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Puzzle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pyramid2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Pyramid: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const QrCode2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const QrCode: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const QrScan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const QuestionMarkCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const QuestionMark: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Quote: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Radiation: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Radio: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RailSymbol: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rain: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Razor: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ReceiptPercentage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Receipt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ReceiveMoney: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RectangleFace: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RectangleSpeaker: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Reddit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Redo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Refresh2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Refresh3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Refresh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Repeat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Reply: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ReportsChart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Resize: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rewind: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RobotBorder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Robot: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RoboticArm: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rocket: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RockingChair: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rollercoaster: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rotate2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RotateAntiClockwise: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RotateClockwise: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rotate: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RoundedCornersBl: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RoundedCornersBr: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RoundedCornersTl: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RoundedCornersTr: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Route: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Router: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rows2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rows: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RssFeed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rucksack: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ruler2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RulerAdd: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const RulerMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ruler: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Rupee: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SafeFlash: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Safe: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SafetyPin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sagittarius: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Salesforce: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Salt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Satellite2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Satellite: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ScaleTool: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scale: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scales: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ScanMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ScanPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ScissorsDashedBorder: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scissors: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scooter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Screw: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Screwdriver: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scroll: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Scrubber: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SdCard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sd: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SearchArea: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const SearchField$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SearchGlobe: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SearchWindow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Search: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Seat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Section: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Seedlings: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Seeds: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SelectFrame: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SendMoney2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SendMoney: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SendToBack2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SendToBack: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SendToFront: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Send: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Server: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ServiceBell: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Settings2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SettingsSliders: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Settings: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sewer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShapeRotate: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shape: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shapes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Share2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Share3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Share: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShieldCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShieldLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShieldSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShieldTick: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShieldUnlock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShieldWarning: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shield: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShipmentArrowDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShipmentArrowUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShipmentCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShipmentCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shipment: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shirt1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShirtFolded: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shirt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShopSign: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShoppingBag: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShoppingBasketCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShoppingBasketCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShoppingBasket: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ShoppingCart: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shorts: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shouting: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shower2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shower: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Shuffle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SideProfile: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sidebar2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sidebar: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sign: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Signage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Signature: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SingleBed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Skateboard: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sketch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Skew: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SkiMask: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SkipBack: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SkipForward: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Skull: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Slash: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Slice: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SlideMenu: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SlidersHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SlidersVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Slideshow2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Slideshow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SmallShapes: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Smartphone: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Smoking: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Snail: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Snapchat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sneaker: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Snorkel: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SnowMobile: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SoapPump: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SoccerPitch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SolarPanels: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sombrero: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SortAscending: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SortDescending: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sos: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Soundcloud: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const South: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spacial: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpacingHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spades: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sparkles2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sparkles: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Speaker2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeakerMute2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeakerMute: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeakerOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeakerVolumeHigh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeakerVolumeLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Speaker: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spectacles2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spectacles: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeechBubbleMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeechBubblePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeechBubble: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeechImportant: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeedFast: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeedGauge: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SpeedSlow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SphereDottedLines: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SphereSplit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sphere: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spider: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spinner: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SplitCellsHorizontal: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SplitCellsVertical: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spoon2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spoon: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spotify: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SprayPaint: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Spreadsheet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquareCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquareCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquareFrame: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquareInterface: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquareIntersect: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquareMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SquarePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Square: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const StackOverflow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Stairs2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Stairs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Stamp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Star: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SteeringWheel: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Stethoscope: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sticker: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const StickyNote: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Stiletto: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Stop: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const StreamToTv2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const StreamToTv: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Strikethrough: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Subscription: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Substitute: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sun: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sunrise2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sunrise: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Swap: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Sweep: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Swimsuit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const SwissArmyKnife: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Switch2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Switch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TShirt: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TableColumns: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TableRows: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TabletDrawing: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tablet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tag2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TagAdd: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tag: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TapLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TapRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Target: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Taurus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Teacher: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Telegram: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Telescope: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TemperatureHigh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TemperatureLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Temperature: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tent: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tepee: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tetrahedron: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tetris: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextAlignCenter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextAlignJustified: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextAlignLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextAlignRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextCapitalise: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextLowercase: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextSparkleShape: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextToSpeech: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TextUppercase: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
declare const Text$1: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ThreeCircleIntersect: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ThreeFingers: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ThumbsDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ThumbsUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ticket: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tickets: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tie: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tiktok: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Timer2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Timer3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Timer4: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TimerCheckmark: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TimerSnooze: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Timer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ToggleLeft: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ToggleRight: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ToiletRoll: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tomahawk: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Toolbox: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ToothPain: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tooth: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Toothbrush: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TopHat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TopLeftDottedSquares: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TopRightDottedSquares: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Toys: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TrafficLights: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trailer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TrainArriving: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TrainDeparting: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Train: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trampoline: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Transform: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trash2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TrashCan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trash: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tree2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tree3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Tree: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trees: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TrendingDown: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TrendingUp: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TriangleCircle2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TriangleCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TriangleRuler: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Triangle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trolly: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trophy: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Trousers: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Truck2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Truck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TurnVolumeHigh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TurnVolumeLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Turntable: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Twitch: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Twitter: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TwoCheckmarks: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TwoChillis: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TwoFingers: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const TwoHearts: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UaeDirham: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ufo2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Ufo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UiBottom: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Umbrella2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Umbrella: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Underline: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Undo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UnionMask: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Union: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UnorderedList: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Unpin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UnreadMessage: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UploadCloud: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Upload: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Upstairs: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Usb: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCircleCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCircleCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCircleMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCirclePlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCircle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserEdit: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UserSparkle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const User: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UsersCheck: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UsersCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UsersMinus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const UsersPlus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Users: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vaccine: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vanity: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vase: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vegan: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Verified: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vest: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VgaCable: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vibrate: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ViceGrip: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VideoCamera2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VideoCameraOff2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VideoCameraOff: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VideoCamera: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Video: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Virgo: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Virus: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VisionPro: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VoiceId2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const VoiceId: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Voicemail: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Volcano: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vpn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vr2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Vr: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Waist: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WallSocketUk: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WallSocketUsa: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wallet: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wallpaper: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wand: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WarningTriangle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Washer: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Waves2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Waves3: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Waves: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Weed: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const West: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wheat: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wheel: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WheelieBin: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Whistle: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Width: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WifiHigh: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WifiLow: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WifiMedium: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WifiNoConnection: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wifi: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WindPower: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wind: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WindowCross: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WindowError: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WindowExpand: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WindowLock: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WindowMinimise: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Windows: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wine: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wink: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wiper: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WirelessHeadphones: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WishList: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const World: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WrapText: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wrench2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Wrench: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WriteCheque: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const WriteNote: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Www: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const XAxis: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Xls: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const YAxis: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const Yen: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const YinYang: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ZipFile2: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ZipFile: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ZoomIn: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export declare const ZoomOut: {
	({ size, width, height, style, ...props }: IconProps): React$1.JSX.Element;
	displayName: string;
};
export interface MenuTriggerProps extends AriaMenuTriggerProps {
	children: [
		React$1.ReactElement,
		React$1.ReactElement
	];
	placement?: PopoverProps["placement"];
}
export declare function MenuTrigger({ children, placement, ...props }: MenuTriggerProps): React$1.JSX.Element;
export interface MenuProps<T> extends Omit<AriaMenuProps<T>, "className"> {
}
declare function Menu$1<T>(props: MenuProps<T>): React$1.JSX.Element;
export interface MenuItemProps<T = object> extends Omit<AriaMenuItemProps<T>, "className"> {
}
export declare function MenuItem<T extends object = object>(props: MenuItemProps<T>): React$1.JSX.Element;
export type MatchItem = {
	match: string;
} | {
	skip: string;
};
export type FuzzyMatch = MatchItem[];
export declare function FuzzyString(props: {
	match: FuzzyMatch;
}): React$1.JSX.Element;
export type FlexShadow = keyof typeof shadow;
export type FlexRadius = keyof typeof radius;
export type FlexBorder = true | BorderColor;
export type PaddingProps = {
	top?: Space;
	left?: Space;
	right?: Space;
	bottom?: Space;
	x?: Space;
	y?: Space;
	xy?: Space;
	children?: React$1.ReactNode;
};
declare function Padding$1(props: PaddingProps): React$1.JSX.Element;
export type FlexProps = {
	gap?: Space;
	p?: Space;
	px?: Space;
	py?: Space;
	pt?: Space;
	pb?: Space;
	padding?: Space;
	children?: React$1.ReactNode;
	alignItems?: React$1.CSSProperties["alignItems"];
	style?: React$1.CSSProperties;
	border?: FlexBorder;
	shadow?: FlexShadow;
	radius?: FlexRadius;
} & ({
	row?: undefined;
	column: true;
} | {
	row: true;
	column?: undefined;
});
export declare function Flex(props: FlexProps): React$1.JSX.Element;
export type GapProps = {
	width: Space;
} | {
	height: Space;
};
export declare function Gap(props: GapProps): React$1.JSX.Element;
export declare function Spacer(): React$1.JSX.Element;
export declare function Divider(): React$1.JSX.Element;
export type TextProps = Omit<React$1.ComponentPropsWithoutRef<"span">, "color"> & {
	size?: TextSize;
	fontWeight?: TextWeight;
	color?: TextColor;
	monospace?: boolean;
};
declare function Text$1({ size, fontWeight, color, monospace, className, children, ...props }: TextProps): React$1.JSX.Element;
declare function H1$1(props: {
	children: string;
}): React$1.JSX.Element;
declare function H2$1(props: {
	children: string;
}): React$1.JSX.Element;
declare function H3$1(props: {
	children: string;
}): React$1.JSX.Element;
export declare function H4(props: {
	children: string;
}): React$1.JSX.Element;
export declare function P(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare const labelText: StyleElement;
export declare function Label(props: React$1.LabelHTMLAttributes<HTMLLabelElement> & {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
declare function Blockquote$1(props: {
	children: string;
}): React$1.JSX.Element;
export declare function Ul(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function Ol(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function Li(props: {
	children: React$1.ReactNode;
}): React$1.JSX.Element;
export declare function CodeBlock(props: {
	children: string;
	lang: string;
}): React$1.JSX.Element;
export type CodeProps = React$1.HTMLAttributes<HTMLElement>;
declare function Code$1({ className, children, ...props }: CodeProps): React$1.JSX.Element;
export declare function Kbd({ className, children, ...props }: CodeProps): React$1.JSX.Element;
export interface CollectionPopoverProps extends Omit<PopoverProps, "className"> {
}
export declare function CollectionPopover({ placement, offset, ...props }: CollectionPopoverProps): React$1.JSX.Element;
export declare const navigationItem: StyleElement;
/*
 * Foundation: useLocation and paths
 */
export type Path = string;
export type PathPattern = string | RegExp;
export type SearchString = string;
export type HrefsFormatter = (href: string, router?: any) => string;
// the base useLocation hook type. Any custom hook (including the
// default one) should inherit from it.
export type BaseLocationHook = {
	(...args: any[]): [
		Path,
		(path: Path, ...args: any[]) => any
	];
	searchHook?: BaseSearchHook;
	hrefs?: HrefsFormatter;
};
export type BaseSearchHook = (...args: any[]) => SearchString;
/*
 * Utility types that operate on hook
 */
// Returns the type of the location tuple of the given hook.
export type HookReturnValue<H extends BaseLocationHook> = ReturnType<H>;
// Utility type that allows us to handle cases like `any` and `never`
export type EmptyInterfaceWhenAnyOrNever<T> = 0 extends 1 & T ? {} : [
	T
] extends [
	never
] ? {} : T;
// Returns the type of the navigation options that hook's push function accepts.
export type HookNavigationOptions<H extends BaseLocationHook> = EmptyInterfaceWhenAnyOrNever<NonNullable<Parameters<HookReturnValue<H>[1]>[1]> // get's the second argument of a tuple returned by the hook
>;
declare const navigate: <S = any>(to: string | URL, options?: {
	replace?: boolean;
	state?: S;
	transition?: boolean;
}) => void;
/*
 * Default `useLocation`
 */
// The type of the default `useLocation` hook that wouter uses.
// It operates on current URL using History API, supports base path and can
// navigate with `pushState` or `replaceState`.
export type BrowserLocationHook = (options?: {
	ssrPath?: Path;
}) => [
	Path,
	typeof navigate
];
export type Parser = (route: Path, loose?: boolean) => {
	pattern: RegExp;
	keys: string[];
};
// Standard navigation options supported by all built-in location hooks
export type NavigateOptions<S = any> = {
	replace?: boolean;
	state?: S;
	/** Enable view transitions for this navigation (used with aroundNav) */
	transition?: boolean;
};
// Function that wraps navigate calls, useful for view transitions
export type AroundNavHandler = (navigate: (to: Path, options?: NavigateOptions) => void, to: Path, options?: NavigateOptions) => void;
// state captured during SSR render
export type SsrContext = {
	// if a redirect was encountered, this will be populated with the path
	redirectTo?: Path;
	// HTTP status code to set for SSR response
	statusCode?: number;
};
// basic options to construct a router
export type RouterOptions = {
	hook?: BaseLocationHook;
	searchHook?: BaseSearchHook;
	base?: Path;
	parser?: Parser;
	ssrPath?: Path;
	ssrSearch?: SearchString;
	ssrContext?: SsrContext;
	hrefs?: HrefsFormatter;
	aroundNav?: AroundNavHandler;
};
export type StringRouteParams<T extends string> = RouteParams<T> & {
	[param: number]: string | undefined;
};
export type RegexRouteParams = {
	[key: string | number]: string | undefined;
};
/**
 * Route patterns and parameters
 */
export interface DefaultParams {
	readonly [paramName: string | number]: string | undefined;
}
export type Params<T extends DefaultParams = DefaultParams> = T;
export type MatchWithParams<T extends DefaultParams = DefaultParams> = [
	true,
	Params<T>
];
export type NoMatch = [
	false,
	null
];
export type Match<T extends DefaultParams = DefaultParams> = MatchWithParams<T> | NoMatch;
/*
 * Components: <Route />
 */
export interface RouteComponentProps<T extends DefaultParams = DefaultParams> {
	params: T;
}
export interface RouteProps<T extends DefaultParams | undefined = undefined, RoutePath extends PathPattern = PathPattern> {
	children?: ((params: T extends DefaultParams ? T : RoutePath extends string ? StringRouteParams<RoutePath> : RegexRouteParams) => React$1.ReactNode) | React$1.ReactNode;
	path?: RoutePath;
	component?: React$1.JSXElementConstructor<RouteComponentProps<T extends DefaultParams ? T : RoutePath extends string ? StringRouteParams<RoutePath> : RegexRouteParams>>;
	nest?: boolean;
}
declare function Route$1<T extends DefaultParams | undefined = undefined, RoutePath extends PathPattern = PathPattern>(props: RouteProps<T, RoutePath>): ReturnType<React$1.FunctionComponent>;
/*
 * Components: <Link /> & <Redirect />
 */
export type NavigationalProps<H extends BaseLocationHook = BrowserLocationHook> = ({
	to: Path;
	href?: never;
} | {
	href: Path;
	to?: never;
}) & HookNavigationOptions<H>;
export type RedirectProps<H extends BaseLocationHook = BrowserLocationHook> = NavigationalProps<H> & {
	children?: never;
};
export function Redirect<H extends BaseLocationHook = BrowserLocationHook>(props: RedirectProps<H>, context?: any): null;
export type AsChildProps<ComponentProps, DefaultElementProps> = ({
	asChild?: false;
} & DefaultElementProps) | ({
	asChild: true;
} & ComponentProps);
export type HTMLLinkAttributes = Omit<React$1.AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
	className?: string | undefined | ((isActive: boolean) => string | undefined);
};
export type LinkProps<H extends BaseLocationHook = BrowserLocationHook> = NavigationalProps<H> & AsChildProps<{
	children: React$1.ReactElement;
	onClick?: React$1.MouseEventHandler;
}, HTMLLinkAttributes & React$1.RefAttributes<HTMLAnchorElement>>;
declare function Link$1<H extends BaseLocationHook = BrowserLocationHook>(props: LinkProps<H>, context?: any): ReturnType<React$1.FunctionComponent>;
/*
 * Components: <Switch />
 */
export interface SwitchProps {
	location?: string;
	children: React$1.ReactNode;
}
declare const Switch$1: React$1.FunctionComponent<SwitchProps>;
/*
 * Components: <Router />
 */
export type RouterProps = RouterOptions & {
	children: React$1.ReactNode;
};
declare const Router$1: React$1.FunctionComponent<RouterProps>;
export function useRoute<T extends DefaultParams | undefined = undefined, RoutePath extends PathPattern = PathPattern>(pattern: RoutePath): Match<T extends DefaultParams ? T : RoutePath extends string ? StringRouteParams<RoutePath> : RegexRouteParams>;
export function useLocation<H extends BaseLocationHook = BrowserLocationHook>(): HookReturnValue<H>;
export function useParams<T = undefined>(): T extends string ? StringRouteParams<T> : T extends undefined ? DefaultParams : T;

declare namespace Icons {
	export { AZSort, Accessibility, Acorn, Activity, AddVideo, Aerial, Aerosol, Ai, AiBot, AiDocument, AiImage, AiImage2, AiText, AirTrafficControl, AirplayToTv, Airpods, AirpodsCase, Alarm, AlarmWarning, Alert, Alien, Alien2, AlignArrowDown, AlignArrowLeft, AlignArrowRight, AlignArrowUp, AlignBottom, AlignCentreHorizontal, AlignCentreVertical, AlignHorizontalCenter, AlignLeft, AlignRight, AlignTop, AlignVerticalCenter, AltKey, Anchor, Angle, AnimationEnter, AnimationExit, Annotation, AnnotationDots, AnnotationWarning, Announcement, AppStore, Apple, Apple2, ApplePay, AppleWatch, AppleWatchUltra, Apps, Aquarius, ArCubeDashedBorder, ArcheryArrow, Archive, ArchiveArrowDown, ArchiveArrowUp, ArchiveCheck, ArchiveMinus, ArchivePlus, ArchiveStack, Aries, Armchair, ArrowBottomLeftCorner, ArrowBottomLeftSquare, ArrowBottomRightCorner, ArrowBottomRightSquare, ArrowDown, ArrowDownCircle, ArrowDownInCircle, ArrowDownLeft, ArrowDownLeftCircle, ArrowDownPercentage, ArrowDownRight, ArrowDownRightCircle, ArrowLeft, ArrowLeftCircle, ArrowRight, ArrowRightCircle, ArrowTopLeftCorner, ArrowTopLeftSquare, ArrowTopRightCorner, ArrowTopRightSquare, ArrowUp, ArrowUpCircle, ArrowUpInCircle, ArrowUpLeft, ArrowUpLeftCircle, ArrowUpPercentage, ArrowUpRight, ArrowUpRightCircle, Arrows, AspectRatio, Asterisk, Astronomy, AtSign, AvatarCheckSquare, AvatarHexagonal, AvatarSquare, Award, Axe, Axes, Back, Backpack, Bacteria, Badge$1 as Badge, Badge2, Baguette, Baht, BalanceSheet, Ball, BallRolling, BallRollingFast, Balloon, Balloons, Ballot, BallotBox, Banana, BandAid, Bandages, Bank, BankNote, Barcode, Barcode2, Baseball, BaseballHelmet, Bath, Battery, BatteryCharging, BatteryError, BatteryFull, BatteryLow, BatteryMedium, Bbq, Beach, Beach2, Bed, Beer, Bell, BellCheck, BellCross, BellOff, BellRinging, BellSnooze, Bezier, BezierControlPoints, BezierCurve, BezierCurve2, BezierPlus, Bicycle, Binary, Binoculars, Bird, Bird2, BirdHouse, Bitcoin, BlindsClosed, BlindsOpen, BlockInside, BlockOutside, Blockquote, Bluetooth, Boat, Bold, Bolt, BoltAuto, Bone, Bonfire, Book, Book2, BookOpen, Bookmark, Bookmark2, Books, BorderBottom, BorderCentre, BorderLeft, BorderRadiusBottomLeft, BorderRadiusBottomRight, BorderRadiusTopLeft, BorderRadiusTopRight, BorderRight, BorderTop, Borders, Bottle, BottomLeftDottedSquares, BottomRightDottedSquares, BounceLeft, BounceRight, Bowl, Bowling, Box, BoxCheck, BoxCross, BoxSparkle, BoxSparkle2, Boxes, Braces, BracesWithDots, Brain, Bread, BrickWall, Bridge, Briefcase, Briefcase2, BriefcaseCheckmark, BriefcaseCross, BrightnessHigh, BrightnessLow, BrightnessMedium, BringForward, Broadcast, BroomSparkles, Browser, BrowserCursor, BrowserError, BrowserHistory, BrowserSparkle, BrowserTabs, Bug, Bug2, Building, Building01, Building2, BuildingMonument, BuildingStore, Buildings, Buildings3, BulbCheck, BulbCross, Bunting, Bunting2, Burger, Bus, Butterfly, Cabinet, Cabinet2, Cabinet3, CableCar, Cactus, Cake, CakeSlice, Calculator, Calculator2, Calendar, CalendarCheck, CalendarCross, CalendarMinus, CalendarPlus, CalendarTimer, Camera, CameraError, CameraError2, CameraGrid, CameraMinus, CameraOff, CameraPlus, CameraTripod, CameraX, Cancer, Candle, CandlestickChart, Capricorn, Captions, Car, Car2, CarBattery, CarDashboard, CarDoor, CarEngine, CarGearStick, CaratDown, CaratLeft, CaratRight, CaratUp, CardHolder, Cards, Cards2, Cart, Cassette, Cat, CatPaw, Cctv, Celsius, Cent, Center, Chart, Chart2, Chart3, ChartDecrease, ChartIncrease, ChartLeftArrowUp, ChartMiddleArrowUp, ChartRightArrowUp, Check, Check2, CheckCircle, CheckCircle2, Checklist, Checklist2, Checkmark, CheckmarkCards, Cheese, ChefsHat, ChemicalBottle, ChemicalTube, ChemicalTube2, Cherry, ChevronDown, ChevronDownLarge, ChevronDownSquare, ChevronLeft, ChevronLeftLarge, ChevronLeftSquare, ChevronRight, ChevronRightLarge, ChevronRightSquare, ChevronTriangleDownSmall, ChevronTriangleLeftSmall, ChevronTriangleRightSmall, ChevronTriangleUpSmall, ChevronUp, ChevronUpLarge, ChevronUpSquare, Chicken, Chilli, ChristmasTree, Circle, CircleDotted, CircleIntersect, CircleLeftHalfFull, CircleMinus, CirclePlus, CircleTwoPoints, CircleX, Citrus, Clean, CleanPower, ClickPulse, ClickableArea, Clipboard$1 as Clipboard, Clock, ClockDottedLine, ClockwiseRefreshStrikethrough, Close, CloseCircle, ClosedCaptions, ClosedCaptionsOff, Closet, Cloud, CloudOff, Clubs, CoatHanger, Cocktail, Code, Code2, Code3, Coffee, CoffeeMachine, Coffin, Cog, Coins, CoinsMinus, CoinsPlus, ColorSwatch, Columns, Columns2, ColumnsHorizontal, ColumnsVertical, Command, CommentCheck, CommentLove, Compass, Components, Cone, Cone2, Cone3, Construction, Contacts, Contract, Contrast, Cookie, Copy, CornerFlag, Cpu, CrackedEgg, CreditCard, CreditCardCheck, CreditCardLock, CreditCardPlus, Crop, Crosshair, Crosshair2, Crowd, Crown, Crown2, CrownGlow, Crucifix, Css, CubeShape, CupStraw, Cursor, CursorBlocked, CursorClick, CursorDottedLine, CursorList, CursorSpinner, CursorText, Cylinder, Dashboard, DataTransfer$1 as DataTransfer, DataTransferCheck, DataTransferError, Database, DatabaseCheck, DatabaseCross, DatabaseError, DatabaseMinus, DatabasePlus, Deathstar, Deer, Delete, Devices, Devices2, DialPad, Diamond, Diamonds, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, DiceCube, Dimensions, Directions, DirectorChair, Disability, Disability2, Discord, Dna, Dna2, DoNotDisturb, Doc, DocumentShield, DocumentSparkle, Dog, Dog2, Dogecoin, Dogecoin2, Dollar, Dollar2, Door, DoorEnter, DoorExit, DoorLock, DoorOpen, DotGridVertical1x3, DotGridVertical2x3, DotGridVertical3x3, Dots, DotsHorizontal, DotsHorizontalCircle, DotsVertical, DotsVerticalCircle, DottedCircleLeft, DottedCircleRight, DoubleBed, DoubleChatBubble, DoubleChevronDown, DoubleChevronLeft, DoubleChevronRight, DoubleChevronUp, DoubleChevronUpDown, Download, DownloadCloud, Downstairs, Dress, Dribbble, Drill, Drink, Drone, Dropbox, Dropdown, Droplet, DropletOff, Droplets, Drums, Drums2, Dumbell, Ear, EarOff, EaseInControl, EaseOutControl, East, Edit, EditShape, Education, EggTimer, ElectricBike, ElectricScooter, Elevator, EmailError, EmailMinus, EmailPlus, EmojiAngry, EmojiError, EmojiHappy, EmojiMinus, EmojiNeutral, EmojiPlus, EmojiSad, EmojiXEyes, EnterKey, Eraser, EscKey, EscalatorDown, EscalatorUp, Ethereum, Euro, Export, Eye, EyeClosed, EyeDashedBorder, EyeDropper, EyeLock, EyeMinus, EyeOff, EyePlus, Face, FaceAngel, FaceBigSmile, FaceBigSmile2, FaceCheck, FaceCry, FaceId, FaceIdError, FaceLaughing, FaceLove, FaceSad, FaceSad2, FaceShock, FaceSmile, FaceStraight, FaceSweat, FaceUpsideDown, FaceWhistle, FaceYawn, Facebook, Fahrenheit, Fan, Fan2, FastForward, FastTrain, Faucet, Feather, Female, Female2, Figma, File$1 as File, File2, FileCheckmark, FileCode, FileDownload2, FileError, FileImportant, FileMinus, FileMinus2, FilePlus, FilePlus2, FileScan, FileSearch, FileShare, FileText, FileText2, FileUser, Files, Film, Filter, Filter2, Filters, Filters2, Finder, FingerCross, FingerHeart, FingerPoint, FingerSwipe, FingerTap, FingerTap2, Fingernail, Fingerprint, Fingerprint2, Fire, Fish, Fishes, Flag, FlagPriority, FlagPriority2, FlagPriority3, Flashlight, FlipHorizontal, FlipHorizontally, FlipVertical, FlipVertically, FloatCenter, FloatLeft, FloatRight, Floorplan, FloppyDisc, Flower, Flower2, Flowers, Folder, FolderCheck, FolderCross, FolderDown, FolderImportant, FolderMinus, FolderOpen, FolderOpen2, FolderOpenCheck, FolderOpenSparkle, FolderPerson, FolderPlus, FolderSearch, FolderShare, FolderStar, FolderUp, FolderZip, FontFamily, FontSize, FoodCan, Forbid, Forbid2, Fork, Fork2, Forward, FountainPen, Frame, Frame2, Framer, FryingPan, Fullscreen, FxOff, GalleryHorizontal, GalleryVertical, GalleryView, GamePad, Gaming, Garage, GardenHose, Gauge, Gavel, Gbp, Gemini, GenerateAi, Ghost, Gif, Gift, GitBranch, GitCommit, GitDiff, GitFork, GitMerge, GitPullRequest, Github, Giving, GivingMoney, GlassSpill, Globe, GlobeLeaf, Gmail, GoldenGateBridge, Golf, GolfBall, Google, GoogleDrive, Gpt, Gradient, Grapes, Gravestone, Grid, Grid2, Grid3, GridMasonry, GridMasonry2, Guitar, Gun, H1, H2, H3, HairClippers, HairPin, Hairdryer, HalfCircleBottom, HalfCircleTop, Hammer, Hand, HandHome, HandImportant, HandLock, HandMinus, HandPlus, HandSlash, Handshake, HardDrive, HardDrive2, HardDriveStorage, Hashtag, Hat, Hd, HeadToHead, Heading, Headphones, Headphones2, Headphones3, Headset, Health, Heart, HeartLock, HeartMinus, HeartPlus, HeartRate, HeartSparkle, HeartStrikethrough, Hearts, Height, Helicopter, Help, HelpCircle, Hexagon, HideKeyboard, Highlighter, Highlighter2, Home, Home2, HomeWifi, Hook, Hourglass, Hubspot, HumidityHigh, HumidityLow, HumiditySensor, Ice, IceCream, IceCream2, Icon12hrClock, Icon16Plus, Icon18Plus, Icon24hrClock, Icon2mDistance, Icon3dRectangle, Icon3dRotate, Icon4g, Icon4k, Icon5g, Icon90Degrees, IdCard, IdCard2, ImageAvatarSparkle, ImageLoadingSparkle, ImageRotateLeft, ImageRotateRight, Inbox, Incognito, IndentLeft, IndentRight, Infinity$1 as Infinity, Information, Ingredients, InputCheck, InputCross, InputCursor, InputField, InsertColumn, InsertRow, Instagram, Iphone, Iphone2, Iphone3, IphoneDualCamera, IphoneProCamera, Iron, Italic, Jetski, Journal, Jpg, Kanban, KanbanPlus, Kerning, Kettle, Kettle2, Key, KeySquare, Keyboard, Keyboard2, Keyhole, Keys, Kiosk, Knife, Knife2, Ladder, Ladder2, Lamp, LampCeiling, Landscape, LandscapeExpand, Language, Language2, Languages, Laptop, Laptop2, LaptopAndPhone, LaptopCheck, LaptopError, Lasso, Lawnmower, Layer1, Layer2, Layer3, LayerMinus, LayerPlus, Layers, LayersDownArrow, LayersUpArrow, LayoutBottom, LayoutLeft, LayoutRight, LayoutTop, Leaderboard, Leaf, Leaf2, Leaf3, Lego, Leo, LetterACircle, LetterBCircle, LetterCCircle, LetterSpacing, Libra, LifeJacket, LightBulb, LightCeiling, LightOff, LightSwitch, Lightning, LineHeight, LineHeight2, Link, LinkBreak, Linked, Linkedin, Livestream, Loading, Location$1 as Location, Lock$1 as Lock, LockBorder, LockUnlocked, LogIn, LogOut, Love, LuggageCarousel, Lungs, MagicHat, MagicMouse, MagicWand, Magnet, MagnetBolt, Mail, Mail as Envelope, MailOpen, MailOpenAttachment, MailOpenCross, MailOpenSparkles, MailOpenTick, Mailbox, Male, Male2, Map$1 as Map, Map2, MapPlus, Mask, Mask2, Maximize, Maximize2, Medical, Menu, Menu2, Merge, Message, MicError, MicMinus, MicPlus, Microchip, Microphone, Microphone2, MicrophoneMute, Microscope, Microwave, Milk, MiniFridge, Minimize, Minimize2, Minus, MinusCircle, Mirror, Mirror2, MirrorHorizontal, Money, MoneyBag, Monitor, Monitor2, Moon, Moon2, MotionSensor, Mountain, Mouse, Move, Mug, Mug2, Mug3, MultipleFolders, Music, MusicNote, MusicNoteSparkle, Navigation, Needle, Network, New, NewHire, NewWindow, NewWithLines, Newspaper, NintendoSwitch, NoAvatar, NoAvatarSquare, NoBluetooth, NoBugs, NoLocation, NoParking, NoPin, NoSmoking, NoWeed, Nordvpn, North, Nose, NoseBleed, Notebook, Nuclear, NumberedList, Nut, Octagon, OneFinger, Onion, OpenPane, Option$1 as Option, Orbit, OrderedList, Package, Padding, PageFlip, Paintbrush, Paintbrush2, Paintbrush3, Paintbucket, Paintbucket2, Paintbucket3, Panoramic, Paperclip, Parenthesis, Parking, Party, Passport, Password, Pause, Pawn, Pdf, Peace, Pen, PenSparkles, PenTool, PenTool2, Pencil, Pencil2, PencilBook, PencilInCircle, PencilWifi, People, Pepper, Percentage, PeriodicTable, Person, PersonCheck, PersonCross, PersonHeart, PersonLaptop, PersonLaptopBubble, PersonSauna, PersonSpeechBubble, PersonWalking, PersonWalkingStick, PersonWithLuggage, Petrol, Pharmacy, Phone, PhoneCall, PhoneCallCross, PhoneCallForward, PhoneCallHangUp, PhoneCallIncoming, PhoneCallOutgoing, PhoneCheck, PhoneSignal, Photo, PhotoError, PhotoFilm, PhotoFrame, PhotoHide, PhotoLens, PhotoMinus, PhotoPlus, Photoshop, PianoKeys, PictureInPicture, PieChart, PieChart3, Piggybank, Pill, Pill2, Pills, Pin, PinCircle, PinOnMap, PinTack, PinTack2, PinTack3, Pipe, Pisces, Pizza, Pizza2, Plane, Plane2, PlaneLanding, PlaneTakeOff, Planet, Play, Plug, PlugIn, PlugOff, PlugOn, Plus, PlusCircle, PlusMinus, Png, Pokeball, Polaroids, Poll, Polywork, Poo, Popcorn, Portrait, PortraitExpand, Pot, Pot2, Power, PowerPlant, Pram, Presentation, Press, Print, PrivateWifi, Projector, Projector2, Puzzle, Pyramid, Pyramid2, QrCode, QrCode2, QrScan, QuestionMark, QuestionMarkCircle, Quote, Radiation, Radio, RailSymbol, Rain, Razor, Receipt, ReceiptPercentage, ReceiveMoney, RectangleFace, RectangleSpeaker, Reddit, Redo, Refresh, Refresh2, Refresh3, Repeat, Reply, ReportsChart, Resize, Rewind, Robot, RobotBorder, RoboticArm, Rocket, RockingChair, Rollercoaster, Rotate, Rotate2, RotateAntiClockwise, RotateClockwise, RoundedCornersBl, RoundedCornersBr, RoundedCornersTl, RoundedCornersTr, Route, Router, Rows, Rows2, RssFeed, Rucksack, Ruler, Ruler2, RulerAdd, RulerMinus, Rupee, Safe, SafeFlash, SafetyPin, Sagittarius, Salesforce, Salt, Satellite, Satellite2, Scale, ScaleTool, Scales, Scan, ScanMinus, ScanPlus, Scissors, ScissorsDashedBorder, Scooter, Screw, Screwdriver, Scroll, Scrubber, Sd, SdCard, Search, SearchArea, SearchField$1 as SearchField, SearchGlobe, SearchWindow, Seat, Section, Seedlings, Seeds, SelectFrame, Send, SendMoney, SendMoney2, SendToBack, SendToBack2, SendToFront, Server, ServiceBell, Settings, Settings2, SettingsSliders, Sewer, Shape, ShapeRotate, Shapes, Share, Share2, Share3, Shield, ShieldCross, ShieldLock, ShieldSparkle, ShieldTick, ShieldUnlock, ShieldWarning, Shipment, ShipmentArrowDown, ShipmentArrowUp, ShipmentCheck, ShipmentCross, Shirt, Shirt1, ShirtFolded, ShopSign, ShoppingBag, ShoppingBasket, ShoppingBasketCheck, ShoppingBasketCross, ShoppingCart, Shorts, Shouting, Shower, Shower2, Shuffle, SideProfile, Sidebar, Sidebar2, Sign, Signage, Signature, SingleBed, Skateboard, Sketch, Skew, SkiMask, SkipBack, SkipForward, Skull, Slash, Slice, SlideMenu, SlidersHorizontal, SlidersVertical, Slideshow, Slideshow2, SmallShapes, Smartphone, Smoking, Snail, Snapchat, Sneaker, Snorkel, SnowMobile, SoapPump, SoccerPitch, SolarPanels, Sombrero, SortAscending, SortDescending, Sos, Soundcloud, South, Spacial, SpacingHorizontal, Spades, Sparkles, Sparkles2, Speaker, Speaker2, SpeakerMute, SpeakerMute2, SpeakerOff, SpeakerVolumeHigh, SpeakerVolumeLow, Spectacles, Spectacles2, SpeechBubble, SpeechBubbleMinus, SpeechBubblePlus, SpeechImportant, SpeedFast, SpeedGauge, SpeedSlow, Sphere, SphereDottedLines, SphereSplit, Spider, Spinner, SplitCellsHorizontal, SplitCellsVertical, Spoon, Spoon2, Spotify, SprayPaint, Spreadsheet, Square, SquareCheck, SquareCross, SquareFrame, SquareInterface, SquareIntersect, SquareMinus, SquarePlus, StackOverflow, Stairs, Stairs2, Stamp, Star, SteeringWheel, Stethoscope, Sticker, StickyNote, Stiletto, Stop, StreamToTv, StreamToTv2, Strikethrough, Subscription, Substitute, Sun, Sunrise, Sunrise2, Swap, Sweep, Swimsuit, SwissArmyKnife, Switch, Switch2, TShirt, TableColumns, TableRows, Tablet, TabletDrawing, Tag, Tag2, TagAdd, TapLeft, TapRight, Target, Taurus, Teacher, Telegram, Telescope, Temperature, TemperatureHigh, TemperatureLow, Tent, Tepee, Tetrahedron, Tetris, Text$1 as Text, TextAlignCenter, TextAlignJustified, TextAlignLeft, TextAlignRight, TextCapitalise, TextLowercase, TextSparkleShape, TextToSpeech, TextUppercase, ThreeCircleIntersect, ThreeFingers, ThumbsDown, ThumbsUp, Ticket, Tickets, Tie, Tiktok, Timer, Timer2, Timer3, Timer4, TimerCheckmark, TimerSnooze, ToggleLeft, ToggleRight, ToiletRoll, Tomahawk, Toolbox, Tooth, ToothPain, Toothbrush, TopHat, TopLeftDottedSquares, TopRightDottedSquares, Toys, TrafficLights, Trailer, Train, TrainArriving, TrainDeparting, Trampoline, Transform, Trash, Trash2, TrashCan, Tree, Tree2, Tree3, Trees, TrendingDown, TrendingUp, Triangle, TriangleCircle, TriangleCircle2, TriangleRuler, Trolly, Trophy, Trousers, Truck, Truck2, TurnVolumeHigh, TurnVolumeLow, Turntable, Twitch, Twitter, TwoCheckmarks, TwoChillis, TwoFingers, TwoHearts, UaeDirham, Ufo, Ufo2, UiBottom, Umbrella, Umbrella2, Underline, Undo, Union, UnionMask, UnorderedList, Unpin, UnreadMessage, Upload, UploadCloud, Upstairs, Usb, User, UserCheck, UserCircle, UserCircleCheck, UserCircleCross, UserCircleMinus, UserCirclePlus, UserCross, UserEdit, UserMinus, UserPlus, UserSparkle, Users, UsersCheck, UsersCross, UsersMinus, UsersPlus, Vaccine, Vanity, Vase, Vegan, Verified, Vest, VgaCable, Vibrate, ViceGrip, Video, VideoCamera, VideoCamera2, VideoCameraOff, VideoCameraOff2, Virgo, Virus, VisionPro, VoiceId, VoiceId2, Voicemail, Volcano, Vpn, Vr, Vr2, Waist, WallSocketUk, WallSocketUsa, Wallet, Wallpaper, Wand, WarningTriangle, Washer, Waves, Waves2, Waves3, Weed, West, Wheat, Wheel, WheelieBin, Whistle, Width, Wifi, WifiHigh, WifiLow, WifiMedium, WifiNoConnection, Wind, WindPower, WindowCross, WindowError, WindowExpand, WindowLock, WindowMinimise, Windows, Wine, Wink, Wiper, WirelessHeadphones, WishList, World, WrapText, Wrench, Wrench2, WriteCheque, WriteNote, Www, XAxis, Xls, YAxis, Yen, YinYang, ZipFile, ZipFile2, ZoomIn, ZoomOut };
}

export {
	Badge$1 as BadgeIcon,
	Blockquote as BlockquoteIcon,
	Blockquote$1 as Blockquote,
	Clipboard$1 as Clipboard,
	Code as CodeIcon,
	Code$1 as Code,
	DataTransfer$1 as DataTransfer,
	File$1 as File,
	H1 as H1Icon,
	H1$1 as H1,
	H2 as H2Icon,
	H2$1 as H2,
	H3 as H3Icon,
	H3$1 as H3,
	Icons,
	Infinity$1 as Infinity,
	Link as LinkIcon,
	Link$1 as Link,
	Location$1 as Location,
	Lock$1 as Lock,
	Mail as Envelope,
	Map$1 as Map,
	Menu as MenuIcon,
	Menu$1 as Menu,
	Option$1 as Option,
	Padding as PaddingIcon,
	Padding$1 as Padding,
	Route$1 as Route,
	Router$1 as Router,
	SearchField$1 as SearchFieldIcon,
	Switch as SwitchIcon,
	Switch$1 as Switch,
	Text$1 as Text,
	Text$1 as TextIcon,
	sizingTokens as sizing,
	useCallback,
	useEffect,
	useMemo,
	useState,
};

export {};
