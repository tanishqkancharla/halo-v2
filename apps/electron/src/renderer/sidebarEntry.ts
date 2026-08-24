import { backgroundColor, colors, fontFamily, spacing } from "maui";

const sidebarEntrySurface = backgroundColor.elementHover;
const sidebarEntryFg = colors.gray[12];
const sidebarEntryMutedFg = colors.gray[11];
const sidebarEntrySelectedFg = colors.accent[9];

export const sidebarEntryTreeStyles = {
  "--trees-font-family-override": fontFamily,
  "--trees-font-size-override": "13px",
  "--trees-font-weight-regular-override": "400",
  "--trees-font-weight-semibold-override": "500",
  "--trees-bg-override": "transparent",
  "--trees-fg-override": sidebarEntryFg,
  "--trees-fg-muted-override": sidebarEntryMutedFg,
  "--trees-bg-muted-override": sidebarEntrySurface,
  "--trees-selected-bg-override": sidebarEntrySurface,
  "--trees-selected-fg-override": sidebarEntrySelectedFg,
  "--trees-accent-override": sidebarEntrySelectedFg,
  "--trees-focus-ring-color-override": colors.accent[8],
  "--trees-border-color-override": "transparent",
  "--trees-border-radius-override": "0px",
  "--trees-padding-inline-override": "0px",
  "--trees-item-padding-x-override": spacing.value(4),
  "--trees-item-margin-x-override": "0px",
  "--trees-indent-guide-bg-override": colors.gray[6],
  "--trees-scrollbar-thumb-override": colors.gray[7],
  "--trees-icon-width-override": "14px",
  "--trees-file-icon-color": sidebarEntryMutedFg,
};

export const sidebarEntryTreeCss = `
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
    color: ${sidebarEntryMutedFg};
  }

  [data-item-selected="true"] [data-item-section="icon"] {
    color: ${sidebarEntrySelectedFg};
  }
`;
