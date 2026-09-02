import { useMemo, useState } from "react";
import { backgroundColor, colors, flex, radius, spacing, text } from "maui";
import { Close } from "maui/icons";
import { style, useStyles } from "purse-styles";
import {
  eventChildren,
  keyed,
  type FlowNode,
  type Keyed,
  type ProcessName,
  type Service,
} from "../model/Program.js";
import { NameText, serviceProcess } from "./badges.tsx";
import { carrierLabels } from "./carriers.tsx";
import { chainKeys, type Expansion, type TreeLevel } from "./FlowTree.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

const nodeHeight = 44;
const charWidth = 7.6;

/**
 * The call stack as a graph that grows as you expand it. Each node is an
 * event or frame; opening one hangs its children below it. A leaf frame
 * shows its source in the side panel.
 */
export function StackGraph(props: {
  nodes: FlowNode[];
  parentKey: string;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  const [selectedKey, setSelectedKey] = useState<string>();
  const graph = useMemo(
    () =>
      visibleGraph(props.nodes, props.parentKey, props.level, props.expansion),
    [props.nodes, props.parentKey, props.level, props.expansion],
  );
  const positioned = useMemo(() => layoutGraph(graph), [graph]);
  const selected = graph.nodes.find((entry) => entry.key === selectedKey);

  function onNodeClick(item: Keyed) {
    const children = visible(item.node.children, item.key, props.level);
    if (children.length === 0) {
      setSelectedKey((current) =>
        current === item.key ? undefined : item.key,
      );
      return;
    }
    if (props.expansion.isExpanded(item.key)) {
      props.expansion.toggle(item.key);
      return;
    }
    const keys = chainKeys(item, props.level);
    props.expansion.open(keys);
    const last = keys[keys.length - 1];
    if (last !== undefined && last.endsWith("#src")) {
      setSelectedKey(last.slice(0, -"#src".length));
    }
  }

  const shell = useStyles(styles.shell);
  const canvas = useStyles(styles.canvas);
  const stage = useStyles(styles.stage);
  const edges = useStyles(styles.edges);

  return (
    <div className={shell}>
      <div className={canvas}>
        <div
          className={stage}
          style={{ width: positioned.width, height: positioned.height }}
        >
          <svg
            className={edges}
            width={positioned.width}
            height={positioned.height}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="flowstack-stack-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  style={{ fill: colors.gray[8] }}
                />
              </marker>
            </defs>
            {positioned.edges.map((edge) => (
              <path
                key={edge.id}
                d={edgePath(edge.points)}
                fill="none"
                style={{ stroke: colors.gray[8] }}
                strokeWidth={1.25}
                markerEnd="url(#flowstack-stack-arrow)"
              />
            ))}
          </svg>
          {positioned.nodes.map((placed) => (
            <NodeCard
              key={placed.item.key}
              placed={placed}
              services={props.services}
              level={props.level}
              expanded={props.expansion.isExpanded(placed.item.key)}
              selected={placed.item.key === selectedKey}
              onClick={() => onNodeClick(placed.item)}
            />
          ))}
        </div>
      </div>
      {selected === undefined ? undefined : (
        <SourcePanel
          item={selected}
          services={props.services}
          onClose={() => setSelectedKey(undefined)}
        />
      )}
    </div>
  );
}

function visible(
  nodes: FlowNode[],
  parentKey: string,
  level: TreeLevel,
): Keyed[] {
  return level === "events"
    ? eventChildren(nodes, parentKey)
    : keyed(nodes, parentKey);
}

type VisibleGraph = {
  nodes: Keyed[];
  edges: { id: string; from: string; to: string }[];
};

function visibleGraph(
  nodes: FlowNode[],
  parentKey: string,
  level: TreeLevel,
  expansion: Expansion,
): VisibleGraph {
  const result: VisibleGraph = { nodes: [], edges: [] };
  function add(items: Keyed[], parent: string | undefined) {
    for (const item of items) {
      result.nodes.push(item);
      if (parent !== undefined) {
        result.edges.push({
          id: `${parent}->${item.key}`,
          from: parent,
          to: item.key,
        });
      }
      if (expansion.isExpanded(item.key)) {
        add(visible(item.node.children, item.key, level), item.key);
      }
    }
  }
  add(visible(nodes, parentKey, level), undefined);
  return result;
}

type PlacedNode = {
  item: Keyed;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Positioned = {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: { id: string; points: { x: number; y: number }[] }[];
};

function nodeName(node: FlowNode) {
  return node.kind === "event" ? node.name : node.entry;
}

function nodeWidth(node: FlowNode) {
  const trailing =
    node.kind === "event" ? carrierLabels[node.carrier].length + 2 : 4;
  const chars = nodeName(node).length + trailing;
  return Math.min(420, Math.max(200, chars * charWidth + 64));
}

const nodeGap = 28;
const rankGap = 40;
const margin = 24;

/** Children keep their order and sit centered under their parent. */
function layoutGraph(graph: VisibleGraph): Positioned {
  const childrenOf = new Map<string, Keyed[]>();
  const roots: Keyed[] = [];
  const parents = new Map(graph.edges.map((edge) => [edge.to, edge.from]));
  for (const item of graph.nodes) {
    const parent = parents.get(item.key);
    if (parent === undefined) {
      roots.push(item);
      continue;
    }
    const siblings = childrenOf.get(parent);
    if (siblings === undefined) childrenOf.set(parent, [item]);
    else siblings.push(item);
  }

  const widths = new Map<string, number>();
  function subtreeWidth(item: Keyed): number {
    const children = childrenOf.get(item.key);
    const own = nodeWidth(item.node);
    const below =
      children === undefined
        ? 0
        : children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
          nodeGap * (children.length - 1);
    const width = Math.max(own, below);
    widths.set(item.key, width);
    return width;
  }

  const placed = new Map<string, PlacedNode>();
  let height = 0;
  function place(item: Keyed, left: number, depth: number) {
    const width = widths.get(item.key);
    if (width === undefined) return;
    const own = nodeWidth(item.node);
    const y = margin + depth * (nodeHeight + rankGap);
    height = Math.max(height, y + nodeHeight);
    placed.set(item.key, {
      item,
      x: left + (width - own) / 2,
      y,
      width: own,
      height: nodeHeight,
    });
    const children = childrenOf.get(item.key);
    if (children === undefined) return;
    const childrenWidth =
      children.reduce((sum, child) => {
        const childWidth = widths.get(child.key);
        return childWidth === undefined ? sum : sum + childWidth;
      }, 0) +
      nodeGap * (children.length - 1);
    let cursor = left + (width - childrenWidth) / 2;
    for (const child of children) {
      place(child, cursor, depth + 1);
      const childWidth = widths.get(child.key);
      cursor += (childWidth === undefined ? 0 : childWidth) + nodeGap;
    }
  }

  let cursor = margin;
  for (const root of roots) {
    const width = subtreeWidth(root);
    place(root, cursor, 0);
    cursor += width + nodeGap;
  }

  const edges: Positioned["edges"] = [];
  for (const edge of graph.edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (from === undefined || to === undefined) continue;
    edges.push({
      id: edge.id,
      points: [
        { x: from.x + from.width / 2, y: from.y + from.height },
        { x: to.x + to.width / 2, y: to.y },
      ],
    });
  }
  return {
    width: cursor - nodeGap + margin,
    height: height + margin,
    nodes: [...placed.values()],
    edges,
  };
}

function edgePath(points: { x: number; y: number }[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return "";
  const midY = (first.y + last.y) / 2;
  return `M ${first.x} ${first.y} C ${first.x} ${midY}, ${last.x} ${midY}, ${last.x} ${last.y}`;
}

const processEdge = {
  renderer: style({ borderLeftColor: colors.blue[8] }),
  preload: style({ borderLeftColor: colors.violet[8] }),
  main: style({ borderLeftColor: colors.grass[8] }),
  outside: style({ borderLeftColor: colors.gray[8] }),
} satisfies Record<ProcessName, ReturnType<typeof style>>;

function NodeCard(props: {
  placed: PlacedNode;
  services: Map<string, Service>;
  level: TreeLevel;
  expanded: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const { item } = props.placed;
  const { node } = item;
  const process = serviceProcess(
    props.services.get(node.kind === "event" ? node.from : node.service),
  );
  const children = visible(node.children, item.key, props.level);
  const hasSource = node.kind === "frame" && node.source !== undefined;
  const card = useStyles(
    styles.card,
    node.kind === "event" ? styles.cardEvent : styles.cardFrame,
    processEdge[process],
    props.selected ? styles.cardSelected : undefined,
  );
  const trail = useStyles(styles.trail);
  const marker = useStyles(styles.marker);
  return (
    <button
      type="button"
      className={card}
      style={{
        left: props.placed.x,
        top: props.placed.y,
        width: props.placed.width,
        height: props.placed.height,
      }}
      aria-expanded={children.length > 0 ? props.expanded : undefined}
      data-flowstack-stack-node={nodeName(node)}
      onClick={props.onClick}
    >
      <NameText name={nodeName(node)} process={process} />
      <span className={trail}>
        {node.kind === "event" ? carrierLabels[node.carrier] : undefined}
        {children.length > 0 && !props.expanded ? (
          <span className={marker}>{`+${children.length}`}</span>
        ) : undefined}
        {children.length === 0 && hasSource ? <span>src</span> : undefined}
      </span>
    </button>
  );
}

function SourcePanel(props: {
  item: Keyed;
  services: Map<string, Service>;
  onClose: () => void;
}) {
  const { node } = props.item;
  const panel = useStyles(styles.panel);
  const header = useStyles(styles.panelHeader);
  const title = useStyles(styles.panelTitle);
  const closeButton = useStyles(styles.closeButton);
  const description = useStyles(styles.description);
  const process = serviceProcess(
    props.services.get(node.kind === "event" ? node.from : node.service),
  );
  const note = node.kind === "event" ? node.detail : node.summary;
  return (
    <aside className={panel} aria-label={nodeName(node)}>
      <div className={header}>
        <span className={title}>
          <NameText name={nodeName(node)} process={process} />
        </span>
        <button
          type="button"
          className={closeButton}
          onClick={props.onClose}
          aria-label="Close"
        >
          <Close size="xs" />
        </button>
      </div>
      {note === undefined ? undefined : <p className={description}>{note}</p>}
      {node.kind === "frame" && node.source !== undefined ? (
        <SourceExcerpt source={node.source} />
      ) : undefined}
    </aside>
  );
}

const monospace =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const styles = {
  shell: style(flex({ direction: "row" }), {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
  }),
  canvas: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    display: "grid",
    justifyContent: "safe center",
    alignContent: "start",
    backgroundColor: colors.gray[2],
    backgroundImage: `radial-gradient(${colors.gray[5]} 1px, transparent 1px)`,
    backgroundSize: "20px 20px",
  }),
  stage: style({
    position: "relative",
  }),
  edges: style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  }),
  card: style({
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: spacing.value(3),
    boxSizing: "border-box",
    margin: 0,
    paddingInline: spacing.value(4),
    border: `1px solid ${colors.gray[6]}`,
    borderLeftWidth: "4px",
    backgroundColor: backgroundColor.element,
    color: colors.gray[12],
    fontFamily: monospace,
    fontSize: "13px",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
    "&:hover": {
      borderColor: colors.gray[8],
      backgroundColor: backgroundColor.elementHover,
    },
    "&:focus-visible": {
      outline: `2px solid ${colors.accent[8]}`,
      outlineOffset: "1px",
    },
  }),
  cardFrame: style(radius.md),
  cardEvent: style({
    borderRadius: "999px",
    borderStyle: "dashed",
    borderLeftStyle: "solid",
  }),
  cardSelected: style({
    borderColor: colors.accent[9],
    boxShadow: `0 0 0 2px ${colors.accentAlpha[4]}`,
  }),
  trail: style({
    marginLeft: "auto",
    display: "inline-flex",
    gap: spacing.value(2),
    color: colors.gray[10],
    fontSize: "11px",
  }),
  marker: style({
    color: colors.accent[11],
    fontWeight: 600,
  }),
  panel: style(
    flex({ direction: "column", gap: 3 }),
    spacing.padding({ x: 4, y: 4 }),
    {
      flex: "0 0 auto",
      width: "520px",
      minHeight: 0,
      overflowY: "auto",
      borderLeft: `1px solid ${colors.gray[5]}`,
      backgroundColor: backgroundColor.element,
    },
  ),
  panelHeader: style(flex({ direction: "row", align: "center", gap: 2 })),
  panelTitle: style({
    flex: "1 1 auto",
    minWidth: 0,
    fontFamily: monospace,
    fontSize: "14px",
    overflowWrap: "anywhere",
  }),
  closeButton: style({
    display: "inline-flex",
    padding: "4px",
    border: 0,
    borderRadius: "4px",
    background: "transparent",
    color: colors.gray[10],
    cursor: "pointer",
    "&:hover": {
      backgroundColor: colors.grayAlpha[3],
      color: colors.gray[12],
    },
  }),
  description: style(
    text({ size: "sm", fontWeight: 400, color: "lowContrast" }),
    {
      margin: 0,
    },
  ),
};
