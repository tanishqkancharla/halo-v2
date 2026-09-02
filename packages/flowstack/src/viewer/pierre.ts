import { colors, radius, shadow } from "maui";
import { style } from "purse-styles";

const codeFontFamily =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export const pierreShell = style(radius.md, shadow.subtle, {
  overflow: "hidden",
  minWidth: 0,
});

// Pierre renders nothing for a context-only hunk when `disableFileHeader` is
// set, so the excerpt keeps the header on and hides it (and the "unmodified
// lines" separator) with CSS instead.
const pierreUnsafeCss = `
  :host { --diffs-font-family: ${codeFontFamily}; }
  [data-diffs-header] { display: none; }
  [data-separator] { display: none; }
`;

// Pierre paints each row from --diffs-computed-decoration-bg, so a marked
// line overrides that on its number cell ([data-column-number]) and its code
// cell ([data-line]). Custom properties inherit into the shadow tree, so Maui
// colour variables work here.
function markedLinesCss(lines: number[]) {
  return lines
    .map(
      (line) => `
  [data-column-number="${line}"], [data-line="${line}"] {
    --diffs-computed-decoration-bg: ${colors.accentAlpha[4]};
    cursor: pointer;
  }
  [data-column-number="${line}"] {
    box-shadow: inset 3px 0 0 ${colors.accent[9]};
  }
  [data-column-number="${line}"] [data-line-number-content] {
    color: ${colors.accent[11]};
    font-weight: 600;
  }`,
    )
    .join("\n");
}

export function pierreDiffOptions(
  themeType: "light" | "dark",
  markedLines: number[],
) {
  return {
    theme: { dark: "pierre-dark", light: "pierre-light" } as const,
    themeType,
    overflow: "wrap" as const,
    diffStyle: "unified" as const,
    diffIndicators: "none" as const,
    unsafeCSS: pierreUnsafeCss + markedLinesCss(markedLines),
  };
}
