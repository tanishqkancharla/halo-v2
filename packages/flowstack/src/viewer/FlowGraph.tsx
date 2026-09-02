import { useMemo, useState } from "react";
import { graphlib, layout } from "@dagrejs/dagre";
import {
  Badge,
  Button,
  backgroundColor,
  colors,
  flex,
  spacing,
  text,
} from "maui";
import { ArrowRight, ChevronRight, Close } from "maui/icons";
import { style, useStyles } from "purse-styles";
import {
  levelGraph,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type GraphRoot,
} from "../model/graph.js";
import type {
  EventNode,
  Flow,
  FlowNode,
  Keyed,
  ProcessName,
  Service,
} from "../model/Program.js";
import { ActorBadge, ProcessBadge, StateChip } from "./badges.tsx";
import { carrierLabels } from "./carriers.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

type Selected =
  | { kind: "node"; node: GraphNode }
  | { kind: "event"; entry: Keyed<EventNode> };

const frameHeight = 46;
const actorHeight = 34;
const charWidth = 6.6;
const monoCharWidth = 7.6;

/**
 * One level of the flow as a graph. Actors are boxes, events are numbered
 * edges between them, and at the code level frames chain from the receiver.
 * Clicking an edge badge or a frame with children zooms into it.
 */
export function FlowGraph(props: {
  flow: Flow;
  services: Map<string, Service>;
  level: "events" | "code";
}) {
  const [trail, setTrail] = useState<Keyed[]>([]);
  const [selected, setSelected] = useState<Selected>();
  const [depth, setDepth] = useState<number>(3);

  const current = trail[trail.length - 1];
  const graph = useMemo(() => {
    if (current === undefined) {
      return levelGraph(
        props.flow.children,
        props.flow.id,
        undefined,
        props.level,
        depth,
      );
    }
    const root: GraphRoot =
      current.node.kind === "event"
        ? { kind: "actor", serviceId: current.node.to }
        : { kind: "frame", entry: { key: current.key, node: current.node } };
    return levelGraph(
      current.node.children,
      current.key,
      root,
      props.level,
      depth,
    );
  }, [current, depth, props.flow, props.level]);
  const positioned = useMemo(
    () => layoutGraph(graph, props.services),
    [graph, props.services],
  );

  function zoomInto(entry: Keyed) {
    setTrail((existing) => [...existing, entry]);
    setSelected(undefined);
  }

  function onNodeClick(node: GraphNode) {
    if (node.kind === "frame" && node.entry.node.children.length > 0) {
      const isRoot = current !== undefined && current.key === node.entry.key;
      if (!isRoot) {
        zoomInto(node.entry);
        return;
      }
    }
    setSelected((existing) =>
      existing?.kind === "node" && existing.node.id === node.id
        ? undefined
        : { kind: "node", node },
    );
  }

  function onEdgeClick(edge: GraphEdge) {
    if (edge.event === undefined) return;
    if (edge.event.node.children.length > 0) {
      zoomInto(edge.event);
      return;
    }
    const entry = edge.event;
    setSelected((existing) =>
      existing?.kind === "event" && existing.entry.key === entry.key
        ? undefined
        : { kind: "event", entry },
    );
  }

  const shell = useStyles(styles.shell);
  const crumbs = useStyles(styles.crumbs);
  const crumbSeparator = useStyles(styles.crumbSeparator);
  const body = useStyles(styles.body);
  const canvas = useStyles(styles.canvas);
  const hint = useStyles(styles.hint);
  const depthLabel = useStyles(styles.depthLabel);

  return (
    <div className={shell}>
      <div className={crumbs}>
        <Button
          variant={trail.length === 0 ? "default" : "quiet"}
          onClick={() => {
            setTrail([]);
            setSelected(undefined);
          }}
        >
          {props.flow.title}
        </Button>
        {trail.map((entry, index) => (
          <span key={entry.key} className={crumbs}>
            <span className={crumbSeparator}>
              <ChevronRight size="xs" />
            </span>
            <Button
              variant={index === trail.length - 1 ? "default" : "quiet"}
              onClick={() => {
                setTrail((existing) => existing.slice(0, index + 1));
                setSelected(undefined);
              }}
            >
              {nodeTitle(entry.node)}
            </Button>
          </span>
        ))}
        <span className={hint}>
          Click a numbered event to zoom into what its receiver does. Click a
          box for details.
        </span>
        <span className={depthLabel}>Depth</span>
        {depthChoices.map((choice) => (
          <Button
            key={choice}
            variant={depth === choice ? "default" : "quiet"}
            onClick={() => setDepth(choice)}
          >
            {choice === Number.POSITIVE_INFINITY ? "all" : String(choice)}
          </Button>
        ))}
      </div>
      <div className={body}>
        <div className={canvas}>
          <GraphSvg
            positioned={positioned}
            selected={selected}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
          />
        </div>
        {selected === undefined ? undefined : (
          <DetailPanel
            selected={selected}
            services={props.services}
            onClose={() => setSelected(undefined)}
          />
        )}
      </div>
    </div>
  );
}

const depthChoices = [1, 2, 3, Number.POSITIVE_INFINITY];

function nodeTitle(node: FlowNode) {
  return node.kind === "event" ? node.name : node.entry;
}

type PositionedNode = {
  node: GraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string | undefined;
  process: ProcessName;
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
  if (node.kind === "actor") {
    const service = services.get(node.serviceId);
    const title = service === undefined ? node.serviceId : service.name;
    return {
      width: clamp(title.length * monoCharWidth + 32, 120, 280),
      height: actorHeight,
      title,
      subtitle: undefined,
      process: service === undefined ? "outside" : service.process,
      zoomable: false,
    };
  }
  const frame = node.entry.node;
  const service = services.get(frame.service);
  const title = frame.entry;
  const subtitle = frame.summary;
  return {
    width: clamp(
      Math.max(
        title.length * monoCharWidth + 44,
        subtitle === undefined
          ? 0
          : Math.min(subtitle.length, 40) * charWidth + 28,
      ),
      160,
      320,
    ),
    height: frameHeight,
    title,
    subtitle,
    process: service === undefined ? "outside" : service.process,
    zoomable: frame.children.length > 0,
  };
}

function edgeLabel(edge: GraphEdge) {
  if (edge.event === undefined) return undefined;
  return `${carrierLabels[edge.event.node.carrier]} · ${edge.event.node.name}`;
}

// A long chain laid out left to right scales down past legibility; past this
// width the graph runs top to bottom and scrolls instead.
const maxReadableWidth = 1400;

function layoutGraph(graph: Graph, services: Map<string, Service>): Positioned {
  const wide = layoutGraphIn(graph, services, "LR");
  if (wide.width <= maxReadableWidth) return wide;
  return layoutGraphIn(graph, services, "TB");
}

function layoutGraphIn(
  graph: Graph,
  services: Map<string, Service>,
  rankdir: "LR" | "TB",
): Positioned {
  const g = new graphlib.Graph({ multigraph: true })
    .setGraph({
      rankdir,
      nodesep: rankdir === "LR" ? 32 : 48,
      ranksep: rankdir === "LR" ? 80 : 48,
      edgesep: 20,
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
        width: Math.max(24, chars * charWidth + 8),
        height: label === undefined ? 24 : 40,
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
    fill: colors.grayAlpha[2],
    stroke: colors.gray[8],
    text: colors.gray[11],
  },
} satisfies Record<ProcessName, { fill: string; stroke: string; text: string }>;

function GraphSvg(props: {
  positioned: Positioned;
  selected: Selected | undefined;
  onNodeClick: (node: GraphNode) => void;
  onEdgeClick: (edge: GraphEdge) => void;
}) {
  const svg = useStyles(styles.svg);
  const badge = useStyles(styles.badge);
  const { positioned } = props;
  return (
    <svg
      className={svg}
      style={{ maxWidth: `${positioned.width}px` }}
      viewBox={`0 0 ${positioned.width} ${positioned.height}`}
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label="Flow graph"
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
      {positioned.edges.map((edge) => {
        const isEvent = edge.edge.event !== undefined;
        const zoomable =
          edge.edge.event !== undefined &&
          edge.edge.event.node.children.length > 0;
        const isSelected =
          props.selected?.kind === "event" &&
          edge.edge.event !== undefined &&
          props.selected.entry.key === edge.edge.event.key;
        return (
          <g key={edge.edge.id}>
            <path
              d={smoothPath(edge.points)}
              fill="none"
              style={{ stroke: isEvent ? colors.gray[9] : colors.gray[7] }}
              strokeWidth={isEvent ? 1.5 : 1.25}
              strokeDasharray={isEvent ? undefined : "3 3"}
              markerEnd="url(#flowstack-arrow)"
            />
            <g
              className={isEvent ? badge : undefined}
              transform={`translate(${edge.labelX}, ${edge.labelY - (edge.label === undefined ? 0 : 10)})`}
              onClick={isEvent ? () => props.onEdgeClick(edge.edge) : undefined}
              role={isEvent ? "button" : undefined}
              aria-label={
                edge.edge.event === undefined
                  ? undefined
                  : `Step ${edge.edge.step}: ${edge.edge.event.node.name}`
              }
              tabIndex={isEvent ? 0 : undefined}
            >
              {zoomable ? (
                <circle
                  r={13}
                  fill="none"
                  style={{
                    stroke: isSelected ? colors.accent[11] : colors.accent[7],
                  }}
                  strokeWidth={1.5}
                />
              ) : undefined}
              <circle
                r={isEvent ? 10 : 8}
                style={{ fill: isEvent ? colors.accent[9] : colors.gray[8] }}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isEvent ? 11 : 10}
                fontWeight={600}
                style={{ fill: "white" }}
              >
                {edge.edge.step}
              </text>
            </g>
            {edge.label === undefined ? undefined : (
              <text
                x={edge.labelX}
                y={edge.labelY + 14}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10.5}
                style={{ fill: colors.gray[11] }}
              >
                {truncate(edge.label, 36)}
              </text>
            )}
          </g>
        );
      })}
      {positioned.nodes.map((placed) => (
        <NodeBox
          key={placed.node.id}
          placed={placed}
          selected={
            props.selected?.kind === "node" &&
            props.selected.node.id === placed.node.id
          }
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
  const palette = processFill[placed.process];
  const ghost = placed.process === "outside";

  if (placed.node.kind === "actor") {
    return (
      <g
        className={nodeGroup}
        transform={`translate(${left}, ${top})`}
        onClick={props.onClick}
        role="button"
        aria-label={placed.title}
        tabIndex={0}
        data-flowstack-actor={placed.node.serviceId}
      >
        <rect
          width={placed.width}
          height={placed.height}
          rx={placed.height / 2}
          style={{
            fill: palette.fill,
            stroke: props.selected ? colors.accent[9] : palette.stroke,
          }}
          strokeWidth={props.selected ? 2 : 1.5}
          strokeDasharray={ghost ? "4 3" : undefined}
        />
        <text
          x={placed.width / 2}
          y={placed.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12.5}
          fontWeight={600}
          fontFamily='ui-monospace, "SF Mono", Menlo, Consolas, monospace'
          style={{ fill: colors.gray[12] }}
        >
          {truncate(
            placed.title,
            Math.floor((placed.width - 24) / monoCharWidth),
          )}
        </text>
      </g>
    );
  }

  const maxChars = Math.floor((placed.width - 24) / charWidth);
  return (
    <g
      className={nodeGroup}
      transform={`translate(${left}, ${top})`}
      onClick={props.onClick}
      role="button"
      aria-label={placed.title}
      tabIndex={0}
      data-flowstack-frame={placed.node.entry.node.service}
    >
      <rect
        width={placed.width}
        height={placed.height}
        rx={8}
        style={{
          fill: backgroundColor.element,
          stroke: props.selected ? colors.accent[9] : palette.stroke,
        }}
        strokeWidth={props.selected || placed.zoomable ? 2 : 1}
      />
      <rect
        width={4}
        height={placed.height}
        rx={2}
        style={{ fill: palette.stroke }}
      />
      <text
        x={12}
        y={placed.subtitle === undefined ? placed.height / 2 : 17}
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
      {placed.subtitle === undefined ? undefined : (
        <text
          x={12}
          y={33}
          dominantBaseline="central"
          fontSize={10.5}
          style={{ fill: colors.gray[11] }}
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
  selected: Selected;
  services: Map<string, Service>;
  onClose: () => void;
}) {
  const panel = useStyles(styles.panel);
  const panelHeader = useStyles(styles.panelHeader);
  const panelTitle = useStyles(styles.panelTitle);
  const closeButton = useStyles(styles.closeButton);
  const description = useStyles(styles.description);
  const meta = useStyles(styles.meta);
  const arrow = useStyles(styles.crumbSeparator);
  const stateList = useStyles(styles.stateList);
  const { selected } = props;

  const closeControl = (
    <button
      type="button"
      className={closeButton}
      onClick={props.onClose}
      aria-label="Close"
    >
      <Close size="xs" />
    </button>
  );

  if (selected.kind === "event") {
    const event = selected.entry.node;
    return (
      <aside className={panel} aria-label={event.name}>
        <div className={panelHeader}>
          <span className={panelTitle}>{event.name}</span>
          {closeControl}
        </div>
        <div className={meta}>
          <ActorBadge
            service={props.services.get(event.from)}
            id={event.from}
          />
          <span className={arrow} aria-hidden="true">
            <ArrowRight size="xs" />
          </span>
          <ActorBadge service={props.services.get(event.to)} id={event.to} />
          <Badge>{carrierLabels[event.carrier]}</Badge>
        </div>
        {event.detail === undefined ? undefined : (
          <p className={description}>{event.detail}</p>
        )}
      </aside>
    );
  }

  const { node } = selected;
  const service = props.services.get(
    node.kind === "actor" ? node.serviceId : node.entry.node.service,
  );
  const title =
    node.kind === "actor"
      ? service === undefined
        ? node.serviceId
        : service.name
      : node.entry.node.entry;
  return (
    <aside className={panel} aria-label={title}>
      <div className={panelHeader}>
        <span className={panelTitle}>{title}</span>
        {closeControl}
      </div>
      {service === undefined ? undefined : (
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
      )}
      {node.kind === "actor" ? (
        service === undefined ? undefined : (
          <p className={description}>{service.description}</p>
        )
      ) : (
        <>
          {node.entry.node.summary === undefined ? undefined : (
            <p className={description}>{node.entry.node.summary}</p>
          )}
          {node.entry.node.source === undefined ? undefined : (
            <SourceExcerpt source={node.entry.node.source} />
          )}
        </>
      )}
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
  depthLabel: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
    {
      marginLeft: spacing.value(4),
    },
  ),
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
  badge: style({
    cursor: "pointer",
    "&:hover circle": {
      filter: "brightness(0.9)",
    },
    "&:focus-visible": {
      outline: "none",
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
  meta: style(flex({ direction: "row", align: "center", gap: 2, wrap: true })),
  stateList: style(
    flex({ direction: "row", align: "center", gap: 1, wrap: true }),
    {
      listStyle: "none",
      margin: 0,
      padding: 0,
    },
  ),
};
