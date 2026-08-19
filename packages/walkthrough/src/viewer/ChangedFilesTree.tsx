import { useEffect } from "react";
import type { FileTreeIconConfig } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { WalkthroughFile } from "../extractWalkthrough.js";
import { treeCss, treeStyles } from "./treeTheme.ts";

const fileIconSpriteSheet = `<svg data-icon-sprite aria-hidden="true" width="0" height="0">
  <symbol id="halo-file-icon" viewBox="0 0 24 24" fill="none">
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
    />
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M14 2v4a2 2 0 0 0 2 2h4"
    />
  </symbol>
</svg>`;

const fileTreeIcons: FileTreeIconConfig = {
  set: "minimal",
  spriteSheet: fileIconSpriteSheet,
  remap: {
    "file-tree-icon-file": {
      name: "halo-file-icon",
      viewBox: "0 0 24 24",
    },
  },
};

export function ChangedFilesTree(props: {
  files: readonly WalkthroughFile[];
  onSelect: (path: string) => void;
}) {
  const wrap = useStyles(styles.wrap);
  const headerClassName = useStyles(styles.header);
  const paths = props.files.map((file) => file.path);
  const { model } = useFileTree({
    paths,
    density: "compact",
    icons: fileTreeIcons,
    gitStatus: [...props.files],
    initialExpansion: "open",
    onSelectionChange: (selectedPaths) => {
      const nextPath = selectedPaths[0];
      if (nextPath === undefined) return;
      props.onSelect(nextPath);
    },
    unsafeCSS: treeCss,
  });

  useEffect(() => {
    model.resetPaths([...paths]);
    model.setGitStatus([...props.files]);
  }, [model, props.files, paths]);

  return (
    <div className={wrap}>
      <FileTree
        model={model}
        header={<div className={headerClassName}>Files</div>}
        style={{
          height: "100%",
          minHeight: 0,
          ...treeStyles,
        }}
      />
    </div>
  );
}

const styles = {
  wrap: style({
    width: "100%",
    height: "100%",
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
};
