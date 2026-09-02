import { useMemo, useState } from "react";
import { graphlib, layout } from "@dagrejs/dagre";
import { Button, backgroundColor, colors, flex, spacing, text } from "maui";
import { ChevronRight, Close } from "maui/icons";
import { style, useStyles } from "purse-styles";
import {
  boundaryAround,
  pathGraph,
  type Boundary,
  type FrameNode,
  type GraphEdge,
  type GraphNode,
  type PathGraph,
} from "../model/graph.js";
import type {
  Flow,
  Frame,
  Path,
  ProcessName,
  Service,
} from "../model/Program.js";
import { carrierLabels } from "./carriers.tsx";
import { ProcessBadge, StateChip } from "./PathStack.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

type Level = { key: string; frame: Frame; boundary: Boundary };

const nodeHeight = 46;
const eventHeight = 28;
const charWidth = 6.6;
const monoCharWidth = 7.6;

/**
 * The path as a graph. Services are boxes, numbered edges follow the path,
 * and clicking a box that composes other services zooms into its inner path.
 */
export function FlowGraph(props: {
  flow: Flow;
  services: Map<string, Service>;
}) {
  const serviceName = (id: string) => {
    const service = props.services.get(id);
    return service === undefined ? id : service.name;
  };
  const [levels, setLevels] = useState<Level[]>(() => {
    const index = props.flow.path.findIndex((step) => step.kind === "frame");
    const root = props.flow.path[index];
    if (root === undefined || root.kind !== "frame") return [];
    return [
      {
        key: `${props.flow.id}/${index}`,
        frame: root.frame,
        boundary: boundaryAround(props.flow.path, index, serviceName),
      },
    ];
  });
  const [selectedId, setSelectedId] = useState<string>();

  const current = levels[levels.length - 1];
  const path: Path =
    current === undefined
      ? props.flow.path
      : current.frame.inner === undefined
        ? []
        : current.frame.inner;

  const graph = useMemo(
    () =>
      current === undefined
        ? pathGraph(props.flow.path, props.flow.id, {})
        : pathGraph(
            current.frame.inner === undefined ? [] : current.frame.inner,
            current.key,
            current.boundary,
          ),
    [current, props.flow],
  );
  const positioned = useMemo(
    () => layoutGraph(graph, props.services),
    [graph, props.services],
  );

  function zoomInto(node: FrameNode) {
    const target = node.frames.find((entry) => entry.frame.inner !== undefined);
    if (target === undefined) return false;
    const index = Number(target.key.slice(target.key.lastIndexOf("/") + 1));
    setLevels((existing) => [
      ...existing,
      {
        key: target.key,
        frame: target.frame,
        boundary: boundaryAround(path, index, serviceName),
      },
    ]);
    setSelectedId(undefined);
    return true;
  }

  function onNodeClick(node: GraphNode) {
    if (node.kind === "frame" && zoomInto(node)) return;
    setSelectedId((existing) => (existing === node.id ? undefined : node.id));
  }

  const selected = graph.nodes.find((node) => node.id === selectedId);

  const shell = useStyles(styles.shell);
  const crumbs = useStyles(styles.crumbs);
  const crumbSeparator = useStyles(styles.crumbSeparator);
  const body = useStyles(styles.body);
  const canvas = useStyles(styles.canvas);
  const hint = useStyles(styles.hint);

  return (
    <div className={shell}>
      <div className={crumbs}>
        <Button
          variant={levels.length === 0 ? "default" : "quiet"}
          onClick={() => {
            setLevels([]);
            setSelectedId(undefined);
          }}
        >
          {props.flow.title}
        </Button>
        {levels.map((level, index) => (
          <span key={level.key} className={crumbs}>
            <span className={crumbSeparator}>
              <ChevronRight size="xs" />
            </span>
            <Button
              variant={index === levels.length - 1 ? "default" : "quiet"}
              onClick={() => {
                setLevels((existing) => existing.slice(0, index + 1));
                setSelectedId(undefined);
              }}
            >
              {level.frame.entry}
            </Button>
          </span>
        ))}
        <span className={hint}>
          Click a service with a + to zoom in. Click a leaf to read its source.
        </span>
      </div>
      <div className={body}>
        <div className={canvas}>
          <GraphSvg
            positioned={positioned}
            selectedId={selectedId}
            onNodeClick={onNodeClick}
          />
        </div>
        {selected === undefined ? undefined : (
          <DetailPanel
            node={selected}
            services={props.services}
            onClose={() => setSelectedId(undefined)}
          />
        )}
      </div>
    </div>
  );
}

type PositionedNode = {
  node: GraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string | undefined;
  process: ProcessName | undefined;
  zoomable: boolean;
};

type PositionedEdge = {
  edge: GraphEdge;
  points: { x: number; y: number }[];
  labelX: number;
  labelY: number;
  label: string | undefined;
};

type Positioned = {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
};

function describeNode(
  node: GraphNode,
  services: Map<string, Service>,
): Omit<PositionedNode, "x" | "y" | "node"> {
  if (node.kind === "frame") {
    const service = services.get(node.serviceId);
    const title = service === undefined ? node.serviceId : service.name;
    const subtitle = node.frames
      .map((entry) => entryLabel(entry.frame.entry, title))
      .join(" · ");
    const width = clamp(
      Math.max(
        title.length * monoCharWidth + 44,
        subtitle.length * charWidth + 28,
      ),
      140,
      300,
    );
    return {
      width,
      height: nodeHeight,
      title,
      subtitle,
      process: service?.process,
      zoomable: node.frames.some((entry) => entry.frame.inner !== undefined),
    };
  }
  const title = node.kind === "event" ? node.event.name : node.label;
  const prefix = node.kind === "boundary" ? 5 : 0;
  return {
    width: clamp((title.length + prefix) * charWidth + 32, 96, 280),
    height: eventHeight,
    title,
    subtitle: undefined,
    process: undefined,
    zoomable: false,
  };
}

/** `SessionRegistry.open` inside the `SessionRegistry` box reads as `.open`. */
function entryLabel(entry: string, serviceName: string) {
  if (entry.startsWith(`${serviceName}.`))
    return entry.slice(serviceName.length);
  if (entry === serviceName) return "";
  return entry;
}

function edgeLabel(edge: GraphEdge) {
  if (edge.hop === undefined) return undefined;
  return `${carrierLabels[edge.hop.carrier]} · ${edge.hop.name}`;
}

// A long path laid out left to right scales down past legibility; past this
// width the graph runs top to bottom and scrolls instead.
const maxReadableWidth = 1400;

function layoutGraph(
  graph: PathGraph,
  services: Map<string, Service>,
): Positioned {
  const wide = layoutGraphIn(graph, services, "LR");
  if (wide.width <= maxReadableWidth) return wide;
  return layoutGraphIn(graph, services, "TB");
}

function layoutGraphIn(
  graph: PathGraph,
  services: Map<string, Service>,
  rankdir: "LR" | "TB",
): Positioned {
  const g = new graphlib.Graph({ multigraph: true })
    .setGraph({
      rankdir,
      nodesep: rankdir === "LR" ? 28 : 48,
      ranksep: rankdir === "LR" ? 72 : 44,
      edgesep: 16,
      marginx: 24,
      marginy: 24,
    })
    .setDefaultEdgeLabel(() => ({}));
  const described = new Map(
    graph.nodes.map((node) => [node.id, describeNode(node, services)]),
  );
  for (const node of graph.nodes) {
    const info = described.get(node.id);
    if (info === undefined) continue;
    g.setNode(node.id, { width: info.width, height: info.height });
  }
  for (const edge of graph.edges) {
    const label = edgeLabel(edge);
    const chars = label === undefined ? 0 : Math.min(label.length, 36);
    g.setEdge(
      edge.from,
      edge.to,
      {
        width: Math.max(20, chars * charWidth + 8),
        height: label === undefined ? 20 : 38,
        labelpos: "c",
      },
      edge.id,
    );
  }
  layout(g);

  const nodes: PositionedNode[] = [];
  for (const node of graph.nodes) {
    const info = described.get(node.id);
    const placed = g.node(node.id);
    if (info === undefined || placed.x === undefined || placed.y === undefined)
      continue;
    nodes.push({ node, x: placed.x, y: placed.y, ...info });
  }
  const edges: PositionedEdge[] = [];
  for (const edge of graph.edges) {
    const placed = g.edge(edge.from, edge.to, edge.id);
    if (
      placed.points === undefined ||
      placed.x === undefined ||
      placed.y === undefined
    )
      continue;
    edges.push({
      edge,
      points: placed.points,
      labelX: placed.x,
      labelY: placed.y,
      label: edgeLabel(edge),
    });
  }
  const size = g.graph();
  return {
    width: size.width === undefined ? 0 : size.width,
    height: size.height === undefined ? 0 : size.height,
    nodes,
    edges,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothPath(points: { x: number; y: number }[]) {
  const first = points[0];
  if (first === undefined) return "";
  if (points.length === 2) {
    const last = points[1];
    if (last === undefined) return "";
    const dx = (last.x - first.x) / 2;
    return `M ${first.x} ${first.y} C ${first.x + dx} ${first.y}, ${last.x - dx} ${last.y}, ${last.x} ${last.y}`;
  }
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    const next = points[i + 1];
    if (point === undefined || next === undefined) continue;
    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    d += ` Q ${point.x} ${point.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  if (last !== undefined) d += ` L ${last.x} ${last.y}`;
  return d;
}

const processFill = {
  app: {
    fill: colors.accentAlpha[3],
    stroke: colors.accent[8],
    text: colors.accent[11],
  },
  renderer: {
    fill: colors.blueAlpha[3],
    stroke: colors.blue[8],
    text: colors.blue[11],
  },
  preload: {
    fill: colors.violetAlpha[3],
    stroke: colors.violet[8],
    text: colors.violet[11],
  },
  main: {
    fill: colors.grassAlpha[3],
    stroke: colors.grass[8],
    text: colors.grass[11],
  },
  outside: {
    fill: colors.grayAlpha[3],
    stroke: colors.gray[8],
    text: colors.gray[11],
  },
} satisfies Record<ProcessName, { fill: string; stroke: string; text: string }>;

function GraphSvg(props: {
  positioned: Positioned;
  selectedId: string | undefined;
  onNodeClick: (node: GraphNode) => void;
}) {
  const svg = useStyles(styles.svg);
  const { positioned } = props;
  return (
    <svg
      className={svg}
      style={{ maxWidth: `${positioned.width}px` }}
      viewBox={`0 0 ${positioned.width} ${positioned.height}`}
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label="Path graph"
    >
      <defs>
        <marker
          id="flowstack-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: colors.gray[9] }} />
        </marker>
      </defs>
      {positioned.edges.map((edge) => (
        <g key={edge.edge.id}>
          <path
            d={smoothPath(edge.points)}
            fill="none"
            style={{ stroke: colors.gray[8] }}
            strokeWidth={1.5}
            markerEnd="url(#flowstack-arrow)"
          />
          <g
            transform={`translate(${edge.labelX}, ${edge.labelY - (edge.label === undefined ? 0 : 9)})`}
          >
            <circle r={9} style={{ fill: colors.accent[9] }} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontWeight={600}
              style={{ fill: "white" }}
            >
              {edge.edge.step}
            </text>
          </g>
          {edge.label === undefined ? undefined : (
            <text
              x={edge.labelX}
              y={edge.labelY + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10.5}
              style={{ fill: colors.gray[11] }}
            >
              {truncate(edge.label, 36)}
            </text>
          )}
        </g>
      ))}
      {positioned.nodes.map((placed) => (
        <NodeBox
          key={placed.node.id}
          placed={placed}
          selected={props.selectedId === placed.node.id}
          onClick={() => props.onNodeClick(placed.node)}
        />
      ))}
    </svg>
  );
}

function NodeBox(props: {
  placed: PositionedNode;
  selected: boolean;
  onClick: () => void;
}) {
  const { placed } = props;
  const nodeGroup = useStyles(styles.node);
  const left = placed.x - placed.width / 2;
  const top = placed.y - placed.height / 2;
  const maxChars = Math.floor((placed.width - 24) / charWidth);

  if (placed.node.kind !== "frame") {
    const isIn = placed.node.direction === "in";
    const ghost = placed.node.kind === "boundary";
    const stroke = ghost
      ? colors.gray[8]
      : isIn
        ? colors.green[8]
        : colors.orange[8];
    const fill = ghost
      ? "transparent"
      : isIn
        ? colors.greenAlpha[3]
        : colors.orangeAlpha[3];
    const textColor = ghost
      ? colors.gray[11]
      : isIn
        ? colors.green[11]
        : colors.orange[11];
    return (
      <g
        className={nodeGroup}
        transform={`translate(${left}, ${top})`}
        onClick={props.onClick}
        role="button"
        aria-label={placed.title}
        tabIndex={0}
      >
        <rect
          width={placed.width}
          height={placed.height}
          rx={placed.height / 2}
          style={{ fill, stroke }}
          strokeWidth={props.selected ? 2 : 1}
          strokeDasharray={ghost ? "4 3" : undefined}
        />
        <text
          x={placed.width / 2}
          y={placed.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={500}
          style={{ fill: textColor }}
        >
          {ghost
            ? `${isIn ? "from" : "to"} ${truncate(placed.title, maxChars - 5)}`
            : truncate(placed.title, maxChars)}
        </text>
      </g>
    );
  }

  const palette =
    processFill[placed.process === undefined ? "outside" : placed.process];
  return (
    <g
      className={nodeGroup}
      transform={`translate(${left}, ${top})`}
      onClick={props.onClick}
      role="button"
      aria-label={placed.title}
      tabIndex={0}
      data-flowstack-node={placed.node.serviceId}
    >
      <rect
        width={placed.width}
        height={placed.height}
        rx={8}
        style={{
          fill: palette.fill,
          stroke: props.selected ? colors.accent[9] : palette.stroke,
        }}
        strokeWidth={props.selected || placed.zoomable ? 2 : 1}
      />
      <text
        x={12}
        y={
          placed.subtitle === undefined || placed.subtitle.length === 0
            ? placed.height / 2
            : 17
        }
        dominantBaseline="central"
        fontSize={12.5}
        fontWeight={600}
        fontFamily='ui-monospace, "SF Mono", Menlo, Consolas, monospace'
        style={{ fill: colors.gray[12] }}
      >
        {truncate(
          placed.title,
          Math.floor((placed.width - 36) / monoCharWidth),
        )}
      </text>
      {placed.subtitle === undefined ||
      placed.subtitle.length === 0 ? undefined : (
        <text
          x={12}
          y={33}
          dominantBaseline="central"
          fontSize={10.5}
          style={{ fill: palette.text }}
        >
          {truncate(placed.subtitle, maxChars)}
        </text>
      )}
      {placed.zoomable ? (
        <g transform={`translate(${placed.width - 12}, 12)`}>
          <circle r={8} style={{ fill: palette.stroke }} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={700}
            style={{ fill: "white" }}
          >
            +
          </text>
        </g>
      ) : undefined}
    </g>
  );
}

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function DetailPanel(props: {
  node: GraphNode;
  services: Map<string, Service>;
  onClose: () => void;
}) {
  const panel = useStyles(styles.panel);
  const panelHeader = useStyles(styles.panelHeader);
  const panelTitle = useStyles(styles.panelTitle);
  const closeButton = useStyles(styles.closeButton);
  const description = useStyles(styles.description);
  const meta = useStyles(styles.meta);
  const stateList = useStyles(styles.stateList);
  const entryBlock = useStyles(styles.entryBlock);
  const entryTitle = useStyles(styles.entryTitle);
  const { node } = props;

  if (node.kind !== "frame") {
    const title = node.kind === "event" ? node.event.name : node.label;
    return (
      <aside className={panel} aria-label={title}>
        <div className={panelHeader}>
          <span className={panelTitle}>{title}</span>
          <button
            type="button"
            className={closeButton}
            onClick={props.onClose}
            aria-label="Close"
          >
            <Close size="xs" />
          </button>
        </div>
        {node.kind === "event" ? (
          <p className={description}>
            {node.direction === "in" ? "Inbound" : "Outbound"} over{" "}
            {carrierLabels[node.event.carrier]}
            {node.event.detail === undefined ? "" : ` — ${node.event.detail}`}
          </p>
        ) : (
          <p className={description}>
            The {node.direction === "in" ? "previous" : "next"} service on the
            enclosing path.
          </p>
        )}
      </aside>
    );
  }

  const service = props.services.get(node.serviceId);
  const title = service === undefined ? node.serviceId : service.name;
  return (
    <aside className={panel} aria-label={title}>
      <div className={panelHeader}>
        <span className={panelTitle}>{title}</span>
        <button
          type="button"
          className={closeButton}
          onClick={props.onClose}
          aria-label="Close"
        >
          <Close size="xs" />
        </button>
      </div>
      {service === undefined ? undefined : (
        <>
          <div className={meta}>
            <ProcessBadge process={service.process} />
            {service.state.length === 0 ? undefined : (
              <ul className={stateList} aria-label={`${service.name} state`}>
                {service.state.map((field) => (
                  <li key={field.name}>
                    <StateChip field={field} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className={description}>{service.description}</p>
        </>
      )}
      {node.frames.map((entry) => (
        <div key={entry.key} className={entryBlock}>
          <div className={entryTitle}>{entry.frame.entry}</div>
          {entry.frame.summary === undefined ? undefined : (
            <p className={description}>{entry.frame.summary}</p>
          )}
          {entry.frame.source === undefined ? undefined : (
            <SourceExcerpt source={entry.frame.source} />
          )}
        </div>
      ))}
    </aside>
  );
}

const styles = {
  shell: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
  }),
  crumbs: style(
    flex({ direction: "row", align: "center", gap: 1, wrap: true }),
    {
      flex: "0 0 auto",
      paddingInline: spacing.value(4),
      paddingBlock: spacing.value(2),
    },
  ),
  crumbSeparator: style({
    display: "inline-flex",
    color: colors.gray[9],
  }),
  hint: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" }), {
    marginLeft: "auto",
  }),
  body: style(flex({ direction: "row" }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  canvas: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    backgroundColor: colors.gray[2],
    backgroundImage: `radial-gradient(${colors.gray[5]} 1px, transparent 1px)`,
    backgroundSize: "20px 20px",
  }),
  // The viewBox scales the graph down to the canvas width; it never scales up.
  svg: style({
    display: "block",
    width: "100%",
    height: "auto",
  }),
  node: style({
    cursor: "pointer",
    "&:hover rect": {
      filter: "brightness(0.97)",
    },
    "&:focus-visible": {
      outline: "none",
    },
    "&:focus-visible rect": {
      stroke: colors.accent[9],
      strokeWidth: 2,
    },
  }),
  panel: style(
    flex({ direction: "column", gap: 3 }),
    spacing.padding({ x: 4, y: 4 }),
    {
      flex: "0 0 auto",
      width: "400px",
      minHeight: 0,
      overflowY: "auto",
      borderLeft: `1px solid ${colors.gray[5]}`,
      backgroundColor: backgroundColor.element,
    },
  ),
  panelHeader: style(flex({ direction: "row", align: "center", gap: 2 })),
  panelTitle: style(
    text({ size: "md", fontWeight: 600, color: "highContrast" }),
    {
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: "14px",
      flex: "1 1 auto",
      minWidth: 0,
      overflowWrap: "anywhere",
    },
  ),
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
  meta: style(flex({ direction: "row", align: "center", gap: 3, wrap: true })),
  stateList: style(
    flex({ direction: "row", align: "center", gap: 1, wrap: true }),
    {
      listStyle: "none",
      margin: 0,
      padding: 0,
    },
  ),
  entryBlock: style(flex({ direction: "column", gap: 2 }), {
    paddingTop: spacing.value(3),
    borderTop: `1px solid ${colors.gray[5]}`,
    minWidth: 0,
  }),
  entryTitle: style(
    text({ size: "sm", fontWeight: 500, color: "highContrast" }),
    {
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: "12.5px",
    },
  ),
};
