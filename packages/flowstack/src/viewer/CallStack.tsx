import { backgroundColor, colors, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import {
  eventChildren,
  keyed,
  type FlowNode,
  type Keyed,
  type ProcessName,
  type Service,
} from "../model/Program.js";
import { carrierLabels } from "./carriers.tsx";
import { sourceKey, type Expansion, type TreeLevel } from "./FlowTree.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

/**
 * The flow as a call stack in a code block: one line per node, tree glyphs
 * for depth, and a diff gutter that stays blank until there is a diff.
 * Click a line to expand it in place; leaf frames open their source.
 */
export function CallStack(props: {
  nodes: FlowNode[];
  parentKey: string;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  const block = useStyles(styles.block);
  return (
    <div className={block} data-flowstack-callstack>
      <Lines
        items={visible(props.nodes, props.parentKey, props.level)}
        prefix=""
        root
        services={props.services}
        level={props.level}
        expansion={props.expansion}
      />
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

function Lines(props: {
  items: Keyed[];
  prefix: string;
  root: boolean;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  return (
    <>
      {props.items.map((item, index) => {
        const last = index === props.items.length - 1;
        const glyph = props.root ? "" : last ? "└── " : "├── ";
        const childPrefix = props.root
          ? ""
          : `${props.prefix}${last ? "    " : "│   "}`;
        return (
          <Line
            key={item.key}
            item={item}
            glyph={`${props.prefix}${glyph}`}
            childPrefix={childPrefix}
            services={props.services}
            level={props.level}
            expansion={props.expansion}
          />
        );
      })}
    </>
  );
}

function Line(props: {
  item: Keyed;
  glyph: string;
  childPrefix: string;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  const { node, key } = props.item;
  const { expansion } = props;
  const children = visible(node.children, key, props.level);
  const hasChildren = children.length > 0;
  const source = node.kind === "frame" ? node.source : undefined;
  const childrenOpen = hasChildren && expansion.isExpanded(key);
  const sourceOpen =
    source !== undefined &&
    (props.level === "source" || expansion.isExpanded(sourceKey(key)));
  const primaryKey = hasChildren ? key : sourceKey(key);
  const canOpen = hasChildren || source !== undefined;

  const line = useStyles(
    styles.line,
    canOpen ? styles.lineClickable : undefined,
  );
  const gutter = useStyles(styles.gutter);
  const glyph = useStyles(styles.glyph);
  const trail = useStyles(styles.trail);
  const marker = useStyles(styles.marker);
  const sourceToggle = useStyles(
    styles.sourceToggle,
    sourceOpen ? styles.sourceToggleOpen : undefined,
  );
  const excerpt = useStyles(styles.excerpt);
  const lineButton = useStyles(styles.lineButton);

  return (
    <div data-flowstack-line={node.kind === "event" ? node.name : node.entry}>
      <div className={line}>
        <button
          type="button"
          className={lineButton}
          disabled={!canOpen}
          aria-expanded={canOpen ? expansion.isExpanded(primaryKey) : undefined}
          onClick={() => expansion.toggle(primaryKey)}
        >
          <span className={gutter} aria-hidden="true">
            {" "}
          </span>
          <span className={glyph} aria-hidden="true">
            {props.glyph}
          </span>
          {node.kind === "event" ? (
            <EventText
              from={node.from}
              to={node.to}
              name={node.name}
              services={props.services}
            />
          ) : (
            <FrameText
              service={props.services.get(node.service)}
              entry={node.entry}
            />
          )}
          <span className={trail}>
            {node.kind === "event" ? carrierLabels[node.carrier] : undefined}
            {source === undefined
              ? undefined
              : `${shortPath(source.path)}:${source.start}-${source.end}`}
            {hasChildren && !childrenOpen ? (
              <span className={marker}>{`[+${children.length}]`}</span>
            ) : undefined}
          </span>
        </button>
        {source !== undefined && hasChildren ? (
          <button
            type="button"
            className={sourceToggle}
            aria-pressed={sourceOpen}
            onClick={() => expansion.toggle(sourceKey(key))}
          >
            src
          </button>
        ) : undefined}
      </div>
      {sourceOpen && source !== undefined ? (
        <div
          className={excerpt}
          style={{ marginLeft: `calc(${props.childPrefix.length + 2}ch)` }}
        >
          <SourceExcerpt source={source} />
        </div>
      ) : undefined}
      {childrenOpen ? (
        <Lines
          items={children}
          prefix={props.childPrefix}
          root={false}
          services={props.services}
          level={props.level}
          expansion={expansion}
        />
      ) : undefined}
    </div>
  );
}

function shortPath(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

function EventText(props: {
  from: string;
  to: string;
  name: string;
  services: Map<string, Service>;
}) {
  const arrow = useStyles(styles.arrow);
  const name = useStyles(styles.eventName);
  return (
    <>
      <ActorText id={props.from} service={props.services.get(props.from)} />
      <span className={arrow}> → </span>
      <ActorText id={props.to} service={props.services.get(props.to)} />
      <span className={arrow}> · </span>
      <span className={name}>{props.name}</span>
    </>
  );
}

function ActorText(props: { id: string; service: Service | undefined }) {
  const process =
    props.service === undefined ? "outside" : props.service.process;
  const actor = useStyles(styles.actor, processText[process]);
  return (
    <span className={actor}>
      {props.service === undefined ? props.id : props.service.name}
    </span>
  );
}

function FrameText(props: { service: Service | undefined; entry: string }) {
  const process =
    props.service === undefined ? "outside" : props.service.process;
  const entry = useStyles(styles.entry, processText[process]);
  return <span className={entry}>{props.entry}</span>;
}

const processText = {
  renderer: style({ color: colors.blue[11] }),
  preload: style({ color: colors.violet[11] }),
  main: style({ color: colors.grass[11] }),
  outside: style({ color: colors.gray[11] }),
} satisfies Record<ProcessName, ReturnType<typeof style>>;

const styles = {
  block: style(radius.md, spacing.padding({ y: 3 }), {
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: "12.5px",
    lineHeight: "20px",
    border: `1px solid ${colors.gray[5]}`,
    backgroundColor: backgroundColor.element,
    overflowX: "auto",
    minWidth: 0,
  }),
  line: style({
    display: "flex",
    alignItems: "center",
    whiteSpace: "pre",
    paddingRight: spacing.value(3),
  }),
  lineClickable: style({
    "&:hover": {
      backgroundColor: backgroundColor.elementHover,
    },
  }),
  lineButton: style({
    display: "inline-flex",
    alignItems: "center",
    flex: "1 1 auto",
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    whiteSpace: "pre",
    cursor: "pointer",
    "&:disabled": {
      cursor: "default",
    },
    "&:focus-visible": {
      outline: `2px solid ${colors.accent[8]}`,
      outlineOffset: "-2px",
    },
  }),
  gutter: style({
    display: "inline-block",
    width: "2ch",
    textAlign: "center",
    color: colors.gray[9],
    flex: "0 0 auto",
  }),
  glyph: style({
    color: colors.gray[8],
    flex: "0 0 auto",
  }),
  actor: style({
    fontWeight: 600,
  }),
  arrow: style({
    color: colors.gray[9],
  }),
  eventName: style({
    color: colors.gray[12],
  }),
  entry: style({
    fontWeight: 500,
  }),
  trail: style({
    marginLeft: spacing.value(4),
    color: colors.gray[10],
    fontSize: "11px",
    display: "inline-flex",
    gap: spacing.value(2),
  }),
  marker: style({
    color: colors.accent[11],
  }),
  sourceToggle: style(radius.xs, {
    margin: 0,
    marginLeft: spacing.value(2),
    padding: "0 4px",
    border: `1px solid ${colors.gray[6]}`,
    background: "transparent",
    color: colors.gray[10],
    font: "inherit",
    fontSize: "10.5px",
    lineHeight: "16px",
    cursor: "pointer",
    "&:hover": {
      color: colors.gray[12],
      borderColor: colors.gray[8],
    },
  }),
  sourceToggleOpen: style({
    color: colors.accent[11],
    borderColor: colors.accent[8],
  }),
  excerpt: style(spacing.padding({ y: 2 }), {
    marginRight: spacing.value(3),
    whiteSpace: "normal",
    minWidth: 0,
  }),
};
