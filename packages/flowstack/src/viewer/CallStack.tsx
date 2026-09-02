import { backgroundColor, colors, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import {
  keyed,
  type FlowNode,
  type Keyed,
  type Service,
} from "../model/Program.js";
import { NameText, serviceProcess } from "./badges.tsx";
import { carrierLabels } from "./carriers.tsx";
import { SourceExcerpt, type SourceMark } from "./SourceExcerpt.tsx";

/** Which node keys are open. Keys are `${parentKey}/${index}` per level. */
export type Expansion = {
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
};

/**
 * The flow as a call stack in a code block: one line per node, tree glyphs
 * for depth. Opening a line shows the frame's source and, under it, the
 * frames it calls and the events it sends. Source lines that lead to a child
 * are marked; clicking one opens that child.
 */
export function CallStack(props: {
  nodes: FlowNode[];
  parentKey: string;
  services: Map<string, Service>;
  expansion: Expansion;
}) {
  const block = useStyles(styles.block);
  return (
    <div className={block} data-flowstack-callstack>
      <Lines
        items={keyed(props.nodes, props.parentKey)}
        prefix=""
        root
        services={props.services}
        expansion={props.expansion}
      />
    </div>
  );
}

function Lines(props: {
  items: Keyed[];
  prefix: string;
  root: boolean;
  services: Map<string, Service>;
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
  expansion: Expansion;
}) {
  const { node, key } = props.item;
  const { expansion } = props;
  const children = keyed(node.children, key);
  const source = node.kind === "frame" ? node.source : undefined;
  const canOpen = children.length > 0 || source !== undefined;
  const open = canOpen && expansion.isExpanded(key);
  const marks: SourceMark[] = children.flatMap((child) =>
    child.node.at === undefined
      ? []
      : [{ line: child.node.at, onClick: () => expansion.toggle(child.key) }],
  );

  const line = useStyles(
    styles.line,
    canOpen ? styles.lineClickable : undefined,
  );
  const gutter = useStyles(
    styles.gutter,
    canOpen ? styles.gutterOpenable : undefined,
  );
  const glyph = useStyles(styles.glyph);
  const location = useStyles(styles.location);
  const note = useStyles(styles.note);
  const excerpt = useStyles(styles.excerpt);
  const lineButton = useStyles(styles.lineButton);

  return (
    <div data-flowstack-line={nodeName(node)}>
      <button
        type="button"
        className={line}
        disabled={!canOpen}
        aria-expanded={canOpen ? open : undefined}
        onClick={() => expansion.toggle(key)}
      >
        <span className={lineButton}>
          <span className={gutter} aria-hidden="true">
            {canOpen ? (open ? "▼" : "▶") : " "}
          </span>
          <span className={glyph} aria-hidden="true">
            {props.glyph}
          </span>
          <NameText
            name={nodeName(node)}
            process={serviceProcess(
              props.services.get(
                node.kind === "event" ? node.from : node.service,
              ),
            )}
          />
          <span className={location}>
            {node.kind === "event"
              ? carrierLabels[node.carrier]
              : source === undefined
                ? undefined
                : `${shortPath(source.path)}:${source.start}-${source.end}`}
          </span>
          <span className={note}>
            {node.kind === "event" ? node.detail : node.summary}
          </span>
        </span>
      </button>
      {open && source !== undefined ? (
        <div
          className={excerpt}
          style={{ marginLeft: `calc(${props.childPrefix.length + 2}ch)` }}
        >
          <SourceExcerpt source={source} marks={marks} />
        </div>
      ) : undefined}
      {open ? (
        <Lines
          items={children}
          prefix={props.childPrefix}
          root={false}
          services={props.services}
          expansion={expansion}
        />
      ) : undefined}
    </div>
  );
}

function nodeName(node: FlowNode) {
  return node.kind === "event" ? node.name : node.entry;
}

function shortPath(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

const styles = {
  block: style(radius.md, spacing.padding({ y: 4, x: 2 }), {
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: "13px",
    lineHeight: "30px",
    border: `1px solid ${colors.gray[5]}`,
    backgroundColor: backgroundColor.element,
    overflowX: "auto",
    minWidth: 0,
  }),
  line: style({
    display: "flex",
    alignItems: "center",
    width: "100%",
    margin: 0,
    padding: 0,
    paddingRight: spacing.value(3),
    border: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    whiteSpace: "pre",
    cursor: "default",
    "&:focus-visible": {
      outline: `2px solid ${colors.accent[8]}`,
      outlineOffset: "-2px",
    },
  }),
  lineClickable: style({
    cursor: "pointer",
    "&:hover": {
      backgroundColor: backgroundColor.elementHover,
    },
  }),
  lineButton: style({
    display: "inline-flex",
    alignItems: "center",
    flex: "1 1 auto",
    minWidth: 0,
  }),
  gutter: style({
    display: "inline-block",
    width: "2ch",
    textAlign: "center",
    fontSize: "9px",
    color: colors.gray[9],
    flex: "0 0 auto",
  }),
  gutterOpenable: style({
    color: colors.accent[11],
  }),
  glyph: style({
    color: colors.gray[7],
    flex: "0 0 auto",
  }),
  location: style({
    marginLeft: spacing.value(4),
    color: colors.gray[10],
    fontSize: "11px",
    flex: "0 0 auto",
  }),
  note: style({
    marginLeft: spacing.value(6),
    color: colors.gray[9],
    fontSize: "11px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  excerpt: style(spacing.padding({ y: 3 }), {
    marginRight: spacing.value(3),
    whiteSpace: "normal",
    minWidth: 0,
  }),
};
