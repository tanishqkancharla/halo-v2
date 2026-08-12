import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { FileTree as FileTreeModel } from "@pierre/trees";
import {
  FileTree,
  useFileTree,
  useFileTreeSelection,
} from "@pierre/trees/react";
import {
  colors,
  flexItem,
  motionDurationMs,
  motionEasing,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  sidebarEntryTreeCss,
  sidebarEntryTreeStyles,
} from "../sidebarEntry.ts";

export const mockWorkspacePaths = [
  "src/renderer/App.tsx",
  "src/renderer/Sidebar.tsx",
  "src/renderer/MainPane.tsx",
  "src/main/index.ts",
  "src/shared/rpc.ts",
  "package.json",
  "README.md",
  "tsconfig.json",
] as const;

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
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="1.5"
      d="M10 9H8"
    />
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="1.5"
      d="M16 13H8"
    />
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="1.5"
      d="M16 17H8"
    />
  </symbol>
</svg>`;

const fileTreeIcons = {
  set: "minimal" as const,
  colored: false,
  spriteSheet: fileIconSpriteSheet,
  remap: {
    "file-tree-icon-file": {
      name: "halo-file-icon",
      viewBox: "0 0 24 24",
    },
  },
};

type FilesystemProps = {
  paths: readonly string[];
  header?: ReactNode;
  initialSelectedPath?: string;
  onSelectionChange?: (path: string | null) => void;
  onModel?: (model: FileTreeModel) => void;
  showSelectionLabel?: boolean;
};

export function Filesystem({
  paths,
  header,
  initialSelectedPath,
  onSelectionChange,
  onModel,
  showSelectionLabel = false,
}: FilesystemProps) {
  const shell = useStyles(styles.shell);
  const treeWrap = useStyles(styles.treeWrap);
  const selection = useStyles(styles.selection);
  const headerClassName = useStyles(styles.header);
  const { model } = useFileTree({
    paths,
    density: "compact",
    icons: fileTreeIcons,
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
    unsafeCSS: sidebarEntryTreeCss,
  });
  const selectedPaths = useFileTreeSelection(model);
  const selectedPath = selectedPaths[0];
  const overflow = useFileTreeOverflow(model);

  useEffect(() => {
    model.resetPaths([...paths]);
  }, [model, paths]);

  useEffect(() => {
    if (onModel === undefined) return;
    onModel(model);
  }, [model, onModel]);

  return (
    <div className={shell}>
      <div
        className={treeWrap}
        data-overflow-top={overflow.top ? "true" : "false"}
        data-overflow-bottom={overflow.bottom ? "true" : "false"}
      >
        <FileTree
          model={model}
          header={
            header === undefined ? undefined : (
              <div className={headerClassName}>{header}</div>
            )
          }
          style={
            {
              height: "100%",
              minHeight: 0,
              ...sidebarEntryTreeStyles,
            } as CSSProperties
          }
        />
      </div>
      {showSelectionLabel ? (
        <p className={selection}>
          Selected: {selectedPath === undefined ? "none" : selectedPath}
        </p>
      ) : null}
    </div>
  );
}

function useFileTreeOverflow(model: FileTreeModel) {
  const [overflow, setOverflow] = useState({ top: false, bottom: false });

  useEffect(() => {
    let scroll: HTMLElement | null = null;
    let cancelled = false;
    const resize = new ResizeObserver(() => {
      read();
    });

    const getScroll = () => {
      const host = model.getFileTreeContainer();
      if (host === undefined) return null;
      const element = host.shadowRoot?.querySelector(
        "[data-file-tree-virtualized-scroll='true']",
      );
      if (element instanceof HTMLElement) return element;
      return null;
    };

    const attach = () => {
      const next = getScroll();
      if (next === null) return null;
      if (next === scroll) return scroll;
      if (scroll !== null) {
        scroll.removeEventListener("scroll", read);
        resize.disconnect();
      }
      scroll = next;
      scroll.addEventListener("scroll", read, { passive: true });
      resize.observe(scroll);
      return scroll;
    };

    const read = () => {
      if (cancelled) return;
      const element = attach();
      if (element === null) return;
      const top = element.scrollTop > 0;
      const bottom =
        element.scrollTop + element.clientHeight < element.scrollHeight - 1;
      setOverflow((current) => {
        if (current.top === top && current.bottom === bottom) return current;
        return { top, bottom };
      });
    };

    const unsubscribe = model.subscribe(read);
    read();
    // Pierre FileTree assigns its host in a ref callback, then renders the
    // scroller in a later layout effect.
    const retry = window.setTimeout(read, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      unsubscribe();
      resize.disconnect();
      if (scroll !== null) scroll.removeEventListener("scroll", read);
    };
  }, [model]);

  return overflow;
}

const sidebarSurface = `light-dark(${colors.gray[1]}, ${colors.gray[2]})`;

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
    position: "relative",
    "&::before, &::after": {
      content: "''",
      position: "absolute",
      right: 0,
      left: 0,
      height: spacing.value(6),
      pointerEvents: "none",
      zIndex: 2,
      opacity: 0,
      transition: `opacity ${motionDurationMs}ms ${motionEasing}`,
    },
    "&::before": {
      top: 0,
      background: `linear-gradient(to bottom, ${sidebarSurface}, transparent)`,
    },
    "&::after": {
      bottom: 0,
      background: `linear-gradient(to top, ${sidebarSurface}, transparent)`,
    },
    "&[data-overflow-top='true']::before": { opacity: 1 },
    "&[data-overflow-bottom='true']::after": { opacity: 1 },
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
