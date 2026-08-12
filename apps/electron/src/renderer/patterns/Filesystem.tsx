import type { CSSProperties, ReactNode } from "react";
import {
  FileTree,
  useFileTree,
  useFileTreeSelection,
} from "@pierre/trees/react";
import {
  backgroundColor,
  colors,
  flexItem,
  fontFamily,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";

type FilesystemProps = {
  paths: readonly string[];
  header?: ReactNode;
  initialSelectedPath?: string;
  onSelectionChange?: (path: string | null) => void;
};

const mauiTreeStyles = {
  height: "100%",
  minHeight: 0,
  "--trees-font-family-override": fontFamily,
  "--trees-font-size-override": "13px",
  "--trees-font-weight-regular-override": "400",
  "--trees-font-weight-semibold-override": "500",
  "--trees-bg-override": "transparent",
  "--trees-fg-override": colors.gray[12],
  "--trees-fg-muted-override": colors.gray[11],
  "--trees-bg-muted-override": backgroundColor.elementHover,
  "--trees-selected-bg-override": "transparent",
  "--trees-selected-fg-override": colors.accent[9],
  "--trees-accent-override": colors.accent[9],
  "--trees-focus-ring-color-override": colors.accent[8],
  "--trees-border-color-override": "transparent",
  "--trees-border-radius-override": "0px",
  "--trees-padding-inline-override": spacing.value(4),
  "--trees-item-padding-x-override": spacing.value(2),
  "--trees-item-margin-x-override": "0px",
  "--trees-indent-guide-bg-override": colors.gray[6],
  "--trees-scrollbar-thumb-override": colors.gray[7],
  "--trees-file-icon-color": colors.gray[11],
} as CSSProperties;

const mauiTreeCss = `
  [data-type="item"] {
    cursor: default;
  }

  [data-item-selected="true"] {
    font-weight: 500;
  }

  [data-item-section="icon"] {
    color: ${colors.gray[11]};
  }

  [data-item-selected="true"] [data-item-section="icon"] {
    color: ${colors.accent[9]};
  }
`;

export function Filesystem({
  paths,
  header,
  initialSelectedPath,
  onSelectionChange,
}: FilesystemProps) {
  const shell = useStyles(styles.shell);
  const treeWrap = useStyles(styles.treeWrap);
  const selection = useStyles(styles.selection);
  const headerClassName = useStyles(styles.header);
  const { model } = useFileTree({
    paths,
    density: "compact",
    icons: { set: "minimal", colored: false },
    initialExpansion: "open",
    initialSelectedPaths:
      initialSelectedPath === undefined ? undefined : [initialSelectedPath],
    onSelectionChange: (selectedPaths) => {
      if (onSelectionChange === undefined) {
        return;
      }
      const nextPath = selectedPaths[0];
      onSelectionChange(nextPath === undefined ? null : nextPath);
    },
    unsafeCSS: mauiTreeCss,
  });
  const selectedPaths = useFileTreeSelection(model);
  const selectedPath = selectedPaths[0];

  return (
    <div className={shell}>
      <div className={treeWrap}>
        <FileTree
          model={model}
          header={
            header === undefined ? undefined : (
              <div className={headerClassName}>{header}</div>
            )
          }
          style={mauiTreeStyles}
        />
      </div>
      <p className={selection}>
        Selected: {selectedPath === undefined ? "none" : selectedPath}
      </p>
    </div>
  );
}

const styles = {
  shell: style({
    display: "flex",
    flexDirection: "column",
    gap: spacing.value(4),
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
  }),
  treeWrap: style(flexItem({ size: "auto" }), {
    minWidth: 0,
    minHeight: 0,
  }),
  header: style(
    text("xs", 500, "lowContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      letterSpacing: "0.02em",
    },
  ),
  selection: style(flexItem({ size: "hug" }), text("sm", 400, "lowContrast"), {
    margin: 0,
    paddingInline: spacing.value(4),
  }),
};
