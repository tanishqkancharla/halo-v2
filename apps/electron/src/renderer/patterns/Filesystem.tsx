import { useState } from "react";
import { colors, monospace, text } from "maui";
import { Tree, type TreeNode } from "maui/src/patterns/Tree";
import { style, useStyles } from "purse-styles";

export type FilesystemNode = {
  id: string;
  name: string;
  kind: "directory" | "file";
  children?: FilesystemNode[];
};

type FilesystemProps = {
  rootLabel: string;
  items: FilesystemNode[];
  selectedId?: string | null;
  onSelectionChange?: (id: string | null) => void;
};

export function Filesystem({
  rootLabel,
  items,
  selectedId,
  onSelectionChange,
}: FilesystemProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  );
  const shell = useStyles(styles.shell);
  const selection = useStyles(styles.selection);
  const controlled = selectedId !== undefined;
  const activeId = controlled ? selectedId : internalSelectedId;
  const treeItems = toTreeNodes(items);

  return (
    <div className={shell}>
      <Tree
        aria-label={rootLabel}
        label={rootLabel}
        items={treeItems}
        selectedKeys={activeId === null ? [] : [activeId]}
        onSelectionChange={(keys) => {
          const nextKey = [...keys][0];
          const nextId = nextKey === undefined ? null : String(nextKey);
          if (!controlled) {
            setInternalSelectedId(nextId);
          }
          if (onSelectionChange !== undefined) {
            onSelectionChange(nextId);
          }
        }}
      />
      <p className={selection}>
        Selected: {activeId === null ? "none" : activeId}
      </p>
    </div>
  );
}

function toTreeNodes(nodes: FilesystemNode[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    label: node.name,
    children:
      node.kind === "directory" && node.children !== undefined
        ? toTreeNodes(node.children)
        : undefined,
  }));
}

const styles = {
  shell: style(monospace, text("sm", 400, "highContrast"), {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  }),
  selection: style(text("sm", 400, "lowContrast"), {
    margin: 0,
    color: colors.gray[11],
  }),
};
