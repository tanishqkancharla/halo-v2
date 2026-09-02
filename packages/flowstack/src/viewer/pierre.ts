import { radius, shadow } from "maui";
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

export function pierreDiffOptions(themeType: "light" | "dark") {
  return {
    theme: { dark: "pierre-dark", light: "pierre-light" } as const,
    themeType,
    overflow: "wrap" as const,
    diffStyle: "unified" as const,
    diffIndicators: "none" as const,
    unsafeCSS: pierreUnsafeCss,
  };
}
