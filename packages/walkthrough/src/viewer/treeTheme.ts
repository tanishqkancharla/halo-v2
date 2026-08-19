import type { CSSProperties } from "react";
import { backgroundColor, colors, fontFamily, spacing } from "maui";

const surface = backgroundColor.elementHover;
const fg = colors.gray[12];
const mutedFg = colors.gray[11];
const selectedFg = colors.accent[9];

export const treeStyles =
  // SAFETY: Pierre Trees reads these custom properties from a style object.
  {
    "--trees-font-family-override": fontFamily,
    "--trees-font-size-override": "13px",
    "--trees-font-weight-regular-override": "400",
    "--trees-font-weight-semibold-override": "500",
    "--trees-bg-override": "transparent",
    "--trees-fg-override": fg,
    "--trees-fg-muted-override": mutedFg,
    "--trees-bg-muted-override": surface,
    "--trees-selected-bg-override": surface,
    "--trees-selected-fg-override": selectedFg,
    "--trees-accent-override": selectedFg,
    "--trees-focus-ring-color-override": colors.accent[8],
    "--trees-border-color-override": "transparent",
    "--trees-border-radius-override": "0px",
    "--trees-padding-inline-override": "0px",
    "--trees-item-padding-x-override": spacing.value(4),
    "--trees-item-margin-x-override": "0px",
    "--trees-indent-guide-bg-override": colors.gray[6],
    "--trees-scrollbar-thumb-override": colors.gray[7],
    "--trees-icon-width-override": "14px",
    "--trees-file-icon-color": mutedFg,
  } as CSSProperties;

export const treeCss = `
  [data-type="item"] {
    cursor: default;
  }

  [data-item-selected="true"] {
    font-weight: 500;
  }

  [data-item-focused="true"]:not(:focus-visible):before {
    display: none;
  }

  [data-icon-name="file-tree-icon-chevron"] {
    width: 10px;
    height: 10px;
  }

  [data-icon-name="file-tree-icon-file"] {
    fill: none;
    stroke: currentColor;
    width: 14px;
    height: 14px;
  }

  [data-item-section="icon"] {
    color: ${mutedFg};
  }

  [data-item-selected="true"] [data-item-section="icon"] {
    color: ${selectedFg};
  }
`;
