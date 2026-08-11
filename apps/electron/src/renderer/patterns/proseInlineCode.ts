import { colors } from "maui";
import { style } from "purse-styles";

/** Chip treatment for inline `code` inside Maui `proseHtml` trees. */
export const proseInlineCode = style({
  "& :not(pre):not(.maui-code-block) > code": {
    backgroundColor: colors.gray[3],
    borderRadius: "4px",
    // Slightly brighter than body copy on the chip surface.
    color: `color-mix(in oklch, ${colors.gray[12]} 82%, white)`,
    padding: "0.12em 0.4em",
  },
});
