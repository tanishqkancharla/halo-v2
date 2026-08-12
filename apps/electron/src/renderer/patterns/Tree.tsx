import type React from "react";
import { createContext, useContext, useMemo } from "react";
import {
  Button,
  Collection,
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent,
  type TreeProps,
} from "react-aria-components";
import { style, useStyles } from "purse-styles";
import { colors, focusRing, radius, text } from "maui";

export type TreeNode = {
  id: string;
  label: React.ReactNode;
  children?: TreeNode[];
};

export type TreeGuideGeometry = {
  guideCell: number;
  rowHeight: number;
  trunkX: number;
  midY: number;
  diagonalAngleDeg: number;
  diagonalDrop: number;
  labelPaddingLeft: number;
};

// Row height matches the compact navigation rows used elsewhere in Maui.
// (4px top/bottom) = 30px.
export const defaultTreeGuideGeometry: TreeGuideGeometry = {
  guideCell: 20,
  rowHeight: 30,
  trunkX: 10.5,
  midY: 15,
  diagonalAngleDeg: 50,
  diagonalDrop: 7,
  labelPaddingLeft: 4,
};

type TreeEntry = {
  id: string;
  label: React.ReactNode;
  textValue: string;
  ancestorLines: boolean[];
  isLast: boolean;
  children: TreeEntry[];
};

type TreePatternProps = Omit<TreeProps<TreeEntry>, "children" | "items"> & {
  label?: string;
  items: TreeNode[];
  geometry?: TreeGuideGeometry;
};

const TreeGeometryContext = createContext(defaultTreeGuideGeometry);

export function Tree({
  label,
  items,
  className,
  defaultExpandedKeys,
  geometry = defaultTreeGuideGeometry,
  ...props
}: TreePatternProps) {
  const annotatedItems = useMemo(() => annotateTree(items), [items]);
  const expandedKeys = useMemo(
    () =>
      defaultExpandedKeys !== undefined
        ? defaultExpandedKeys
        : collectExpandableKeys(items),
    [defaultExpandedKeys, items],
  );
  const treeClassName = useStyles(treeClass);
  const labelClassName = useStyles(rootLabelClass);
  const ariaTreeListClassName = useStyles(ariaTreeListClass);

  return (
    <TreeGeometryContext.Provider value={geometry}>
      <div className={treeClassName}>
        {label ? (
          <div
            className={labelClassName}
            style={{ minHeight: `${geometry.rowHeight}px` }}
          >
            {label}
          </div>
        ) : null}
        <AriaTree
          {...props}
          className={
            className !== undefined ? className : ariaTreeListClassName
          }
          items={annotatedItems}
          defaultExpandedKeys={expandedKeys}
          selectionMode={
            props.selectionMode !== undefined ? props.selectionMode : "single"
          }
        >
          {(item) => <TreeRow item={item} />}
        </AriaTree>
      </div>
    </TreeGeometryContext.Provider>
  );
}

function TreeRow({ item }: { item: TreeEntry }) {
  const geometry = useContext(TreeGeometryContext);
  const itemClassName = useStyles(treeItemClass);
  const guidesClassName = useStyles(guidesClass);
  const ancestorCellClassName = useStyles(ancestorCellClass);
  const connectorCellClassName = useStyles(connectorCellClass);
  const nameClassName = useStyles(treeNameClass);
  const branchButtonClassName = useStyles(branchButtonClass);

  return (
    <AriaTreeItem
      id={item.id}
      textValue={item.textValue}
      className={itemClassName}
      style={{ height: `${geometry.rowHeight}px` }}
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <span className={guidesClassName}>
            {item.ancestorLines.map((continues, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: guide columns are positional
                key={index}
                className={ancestorCellClassName}
                data-line={continues ? "true" : "false"}
                style={{ width: `${geometry.guideCell}px` }}
                aria-hidden="true"
              />
            ))}
            <span
              className={connectorCellClassName}
              style={{ width: `${geometry.guideCell}px` }}
              aria-hidden="true"
            >
              <Connector
                isLast={item.isLast}
                showTrident={hasChildItems && !isExpanded}
              />
            </span>
            {hasChildItems ? (
              <Button slot="chevron" className={branchButtonClassName}>
                <span
                  className={nameClassName}
                  style={{ paddingLeft: `${geometry.labelPaddingLeft}px` }}
                >
                  {item.label}
                </span>
              </Button>
            ) : (
              <span
                className={nameClassName}
                style={{ paddingLeft: `${geometry.labelPaddingLeft}px` }}
              >
                {item.label}
              </span>
            )}
          </span>
        )}
      </TreeItemContent>
      <Collection items={item.children}>
        {(child) => <TreeRow item={child} />}
      </Collection>
    </AriaTreeItem>
  );
}

function Connector({
  isLast,
  showTrident,
}: {
  isLast: boolean;
  showTrident: boolean;
}) {
  const geometry = useContext(TreeGeometryContext);
  const connectorSvgClassName = useStyles(connectorSvgClass);
  const { guideCell, rowHeight, trunkX, midY, diagonalAngleDeg, diagonalDrop } =
    geometry;

  const diagonalRun =
    diagonalDrop / Math.tan((diagonalAngleDeg * Math.PI) / 180);
  const diagonalStartY = midY - diagonalDrop;
  const diagonalEndX = trunkX + diagonalRun;
  const trunkBottom = isLast ? diagonalStartY : rowHeight;
  const trunk = `M${trunkX} 0 L${trunkX} ${trunkBottom}`;
  const diagonal = `M${trunkX} ${diagonalStartY} L${diagonalEndX} ${midY}`;

  let tail: string;
  if (showTrident) {
    // A rightward-facing trident: a vertical crossbar at the end of the
    // diagonal, with three prongs fanning out toward the (hidden) children.
    const prongHalf = 4;
    const topY = midY - prongHalf;
    const bottomY = midY + prongHalf;
    const crossX = diagonalEndX;
    tail = [
      `M${crossX} ${topY} L${crossX} ${bottomY}`,
      `M${crossX} ${topY} L${guideCell} ${topY}`,
      `M${crossX} ${midY} L${guideCell} ${midY}`,
      `M${crossX} ${bottomY} L${guideCell} ${bottomY}`,
    ].join(" ");
  } else {
    tail = `M${diagonalEndX} ${midY} L${guideCell} ${midY}`;
  }

  return (
    <svg
      className={connectorSvgClassName}
      width={guideCell}
      height={rowHeight}
      viewBox={`0 0 ${guideCell} ${rowHeight}`}
      fill="none"
    >
      <path
        d={`${trunk} ${diagonal} ${tail}`}
        stroke={colors.gray[7]}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function annotateTree(
  nodes: TreeNode[],
  ancestorLines: boolean[] = [],
): TreeEntry[] {
  return nodes.map((node, index) => {
    const isLast = index === nodes.length - 1;
    const children = node.children !== undefined ? node.children : [];

    return {
      id: node.id,
      label: node.label,
      textValue: typeof node.label === "string" ? node.label : node.id,
      ancestorLines,
      isLast,
      children: annotateTree(children, [...ancestorLines, !isLast]),
    };
  });
}

function collectExpandableKeys(nodes: TreeNode[]): string[] {
  const keys: string[] = [];

  for (const node of nodes) {
    if (node.children !== undefined && node.children.length > 0) {
      keys.push(node.id, ...collectExpandableKeys(node.children));
    }
  }

  return keys;
}

const treeClass = style(text("md", 400, "highContrast"), {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
});

const rootLabelClass = style(text("md", 500, "highContrast"), {
  display: "flex",
  alignItems: "center",
  margin: 0,
  padding: 0,
});

const ariaTreeListClass = style({
  display: "flex",
  flexDirection: "column",
  margin: 0,
  padding: 0,
  border: "none",
  background: "transparent",
  outline: "none",
  minWidth: 0,
});

const treeItemClass = style(focusRing(), radius.sm, {
  display: "flex",
  alignItems: "stretch",
  outline: "none",
  cursor: "default",
  "&[data-selected='true']": {
    backgroundColor: colors.grayAlpha[4],
    color: colors.accent[11],
  },
  "&[data-focus-visible='true']": {
    backgroundColor: colors.grayAlpha[3],
  },
  "&[data-hovered='true']": {
    backgroundColor: colors.grayAlpha[3],
  },
});

const guidesClass = style({
  display: "flex",
  alignItems: "stretch",
  minWidth: 0,
  flex: "1 1 auto",
});

const ancestorCellClass = style({
  position: "relative",
  flex: "0 0 auto",
  alignSelf: "stretch",
  "&[data-line='true']::before": {
    content: '""',
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    borderLeft: `1px solid ${colors.gray[7]}`,
  },
});

const connectorCellClass = style({
  flex: "0 0 auto",
  alignSelf: "stretch",
});

const connectorSvgClass = style({
  display: "block",
});

const treeNameClass = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const branchButtonClass = style({
  all: "unset",
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  cursor: "pointer",
  color: "inherit",
  "&:focus-visible": {
    outline: "none",
  },
});
