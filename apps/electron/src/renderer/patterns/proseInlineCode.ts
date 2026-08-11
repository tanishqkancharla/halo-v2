import { colors } from "maui";
import { style } from "purse-styles";

/** Chip treatment for inline `code` inside Maui `proseHtml` trees. */
export const proseInlineCode = style({
  "& :not(pre):not(.maui-code-block) > code": {
    backgroundColor: colors.gray[4],
    borderRadius: "6px",
    color: colors.accent[11],
    padding: "0.15em 0.45em",
  },
});
