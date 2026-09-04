import { backgroundColor, colors, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import {
  keyed,
  type FlowNode,
  type Keyed,
  type Service,
  type Source,
} from "../model/Program.js";
import { ActorName, NameText, serviceProcess } from "./badges.tsx";
import { SourceExcerpt, type SourceMark } from "./SourceExcerpt.tsx";

/** Which node keys are open. Keys are `${parentKey}/${index}` per level. */
export type Expansion = {
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
};

/**
 * The flow as a call stack in a code block: one line per node, tree glyphs
 * for depth.
 *
 * A line is a frame, coloured by the service that runs it. A call that
 * crosses a service boundary shows as the frame that receives it; a reply
 * shows as `↩ value`. Closed, a line shows only the crossings under it,
 * hoisted through the frames, branches and returns between, and grouped
 * under the conditions those had to pass. Open, it shows where it was called
 * (for a crossing), its own source, and its direct children in order: calls,
 * `if` branches, returns, crossings. Source lines that lead to a child are
 * marked; clicking one opens that child.
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
        entries={keyed(props.nodes, props.parentKey).map(asRow)}
        prefix=""
        root
        services={props.services}
        expansion={props.expansion}
      />
    </div>
  );
}

type Entry =
  | { kind: "row"; item: Keyed; guards: string[] }
  | { kind: "guard"; label: string; entries: Entry[] };

function asRow(item: Keyed): Entry {
  return { kind: "row", item, guards: [] };
}

/**
 * The crossings below `items` with everything else folded away, each with
 * the conditions it passed on the way. Error guards (`unless (x instanceof
 * Error)`) are the normal path and are dropped from the label.
 */
function hoist(items: Keyed[], guards: string[]): Entry[] {
  const result: Entry[] = [];
  for (const item of items) {
    const node = item.node;
    const own = [...guards, ...ownGuards(node)];
    if (node.kind === "event" || node.kind === "reply") {
      result.push({ kind: "row", item, guards: own });
      continue;
    }
    const through = node.kind === "branch" ? [...own, node.guard] : own;
    result.push(...hoist(keyed(node.children, item.key), through));
  }
  return result;
}

function ownGuards(node: FlowNode) {
  if (node.guards === undefined) return [];
  return node.guards.filter((guard) => !/instanceof \w*Error\b/.test(guard));
}

/**
 * Crossings nested under the conditions they passed: adjacent entries that
 * share a first condition go under one guard line, and the rest of their
 * conditions group again inside it. A guard with a single guard inside folds
 * into one line, `a · b`.
 */
function grouped(entries: Entry[]): Entry[] {
  const result: Entry[] = [];
  for (const entry of entries) {
    if (entry.kind === "guard" || entry.guards.length === 0) {
      result.push(entry);
      continue;
    }
    const [label, ...rest] = entry.guards;
    if (label === undefined) continue;
    const inner: Entry = { ...entry, guards: rest };
    const last = result.at(-1);
    if (last !== undefined && last.kind === "guard" && last.label === label) {
      last.entries.push(inner);
      continue;
    }
    result.push({ kind: "guard", label, entries: [inner] });
  }
  return result.map((entry) => {
    if (entry.kind !== "guard") return entry;
    const inner = grouped(entry.entries);
    const only = inner[0];
    if (inner.length === 1 && only !== undefined && only.kind === "guard") {
      return { ...only, label: `${entry.label} · ${only.label}` };
    }
    return { ...entry, entries: inner };
  });
}

function Lines(props: {
  entries: Entry[];
  prefix: string;
  root: boolean;
  services: Map<string, Service>;
  expansion: Expansion;
}) {
  return (
    <>
      {props.entries.map((entry) => {
        const glyph = props.root ? "" : indent;
        const childPrefix = props.root ? "" : `${props.prefix}${indent}`;
        const key =
          entry.kind === "row" ? entry.item.key : `guard:${entry.label}`;
        return entry.kind === "row" ? (
          <Line
            key={key}
            item={entry.item}
            glyph={`${props.prefix}${glyph}`}
            childPrefix={childPrefix}
            services={props.services}
            expansion={props.expansion}
          />
        ) : (
          <GuardLine
            key={key}
            label={entry.label}
            entries={entry.entries}
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

const indent = "    ";

/** What one line shows. A crossing merges the event with the frame that receives it. */
type Row = {
  kind: FlowNode["kind"];
  name: string;
  service?: string;
  args?: string;
  callSite?: Source;
  source?: Source;
  returns?: string;
  note?: string;
  children: Keyed[];
};

function rowOf(item: Keyed): Row {
  const { node, key } = item;
  const children = keyed(node.children, key);
  switch (node.kind) {
    case "event": {
      const first = children[0];
      if (first === undefined || first.node.kind !== "frame") {
        return {
          kind: "event",
          name: node.name,
          service: node.to,
          args: node.args,
          callSite: node.callSite,
          returns: node.returns,
          note: node.detail,
          children,
        };
      }
      const frame = first.node;
      return {
        kind: "event",
        name: frame.entry,
        service: frame.service,
        args: node.args,
        callSite: node.callSite,
        source: frame.source,
        returns: frame.returns === undefined ? node.returns : frame.returns,
        note: frame.summary === undefined ? node.detail : frame.summary,
        children: [...keyed(frame.children, first.key), ...children.slice(1)],
      };
    }
    case "reply":
      return {
        kind: "reply",
        name: node.name,
        service: node.from,
        returns: node.value,
        children,
      };
    case "frame":
      return {
        kind: "frame",
        name: node.entry,
        service: node.service,
        source: node.source,
        returns: node.returns,
        note: node.summary,
        children,
      };
    case "branch": {
      const only = children[0];
      if (
        children.length === 1 &&
        only !== undefined &&
        only.node.kind === "return"
      ) {
        return {
          kind: "branch",
          name: `${node.label}  ${returnLabel(only.node.label)}`,
          children: [],
        };
      }
      return { kind: "branch", name: node.label, children };
    }
    case "return":
      return { kind: "return", name: returnLabel(node.label), children };
  }
}

function returnLabel(label: string) {
  return label === "return" ? "↩" : `↩ ${label.slice("return ".length)}`;
}

function Line(props: {
  item: Keyed;
  glyph: string;
  childPrefix: string;
  services: Map<string, Service>;
  expansion: Expansion;
}) {
  const { key } = props.item;
  const { expansion, services } = props;
  const row = rowOf(props.item);
  const canOpen =
    row.source !== undefined ||
    row.callSite !== undefined ||
    row.children.some(
      (child) => child.node.kind !== "event" && child.node.kind !== "reply",
    );
  const open = canOpen && expansion.isExpanded(key);
  const shown = open
    ? row.children.map(asRow)
    : grouped(hoist(row.children, []));
  const marks: SourceMark[] = row.children.flatMap((child) =>
    child.node.at === undefined
      ? []
      : [{ line: child.node.at, onClick: () => expansion.toggle(child.key) }],
  );
  const control = row.kind === "branch" || row.kind === "return";

  const line = useStyles(
    styles.line,
    canOpen ? styles.lineClickable : undefined,
  );
  const gutter = useStyles(
    styles.gutter,
    canOpen ? styles.gutterOpenable : undefined,
  );
  const glyph = useStyles(styles.glyph);
  const args = useStyles(styles.args);
  const location = useStyles(styles.location);
  const returns = useStyles(styles.returns);
  const replyFrom = useStyles(styles.replyFrom);
  const note = useStyles(styles.note);
  const controlText = useStyles(styles.control);
  const excerpt = useStyles(styles.excerpt);
  const lineButton = useStyles(styles.lineButton);

  return (
    <div data-flowstack-line={row.name} data-flowstack-key={key}>
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
          {control ? (
            <span className={controlText}>{row.name}</span>
          ) : row.kind === "reply" ? (
            <>
              <ActorName
                name="↩"
                process={serviceProcess(
                  row.service === undefined
                    ? undefined
                    : services.get(row.service),
                )}
              />
              <span className={replyFrom}>{row.name} return</span>
              {row.returns === undefined ? undefined : (
                <span className={args}>({row.returns})</span>
              )}
            </>
          ) : (
            <NameText
              name={row.name}
              process={serviceProcess(
                row.service === undefined
                  ? undefined
                  : services.get(row.service),
              )}
            />
          )}
          {row.args === undefined ? undefined : (
            <span className={args}>({row.args})</span>
          )}
          {row.source === undefined ? undefined : (
            <span className={location}>
              {`${shortPath(row.source.path)}:${row.source.start}-${row.source.end}`}
            </span>
          )}
          {row.returns === undefined ||
          row.returns === "void" ||
          row.kind === "reply" ? undefined : (
            <span className={returns}>↩ {row.returns}</span>
          )}
          {row.note === undefined ? undefined : (
            <span className={note}>{row.note}</span>
          )}
        </span>
      </button>
      {open && row.callSite !== undefined ? (
        <div
          className={excerpt}
          style={{ marginLeft: `calc(${props.childPrefix.length + 2}ch)` }}
        >
          <SourceExcerpt
            source={row.callSite}
            marks={
              props.item.node.at === undefined
                ? []
                : [{ line: props.item.node.at }]
            }
          />
        </div>
      ) : undefined}
      {open && row.source !== undefined ? (
        <div
          className={excerpt}
          style={{ marginLeft: `calc(${props.childPrefix.length + 2}ch)` }}
        >
          <SourceExcerpt source={row.source} marks={marks} />
        </div>
      ) : undefined}
      <Lines
        entries={shown}
        prefix={props.childPrefix}
        root={false}
        services={services}
        expansion={expansion}
      />
    </div>
  );
}

function GuardLine(props: {
  label: string;
  entries: Entry[];
  glyph: string;
  childPrefix: string;
  services: Map<string, Service>;
  expansion: Expansion;
}) {
  const line = useStyles(styles.line);
  const gutter = useStyles(styles.gutter);
  const glyph = useStyles(styles.glyph);
  const control = useStyles(styles.control);
  const lineButton = useStyles(styles.lineButton);
  return (
    <div data-flowstack-guard={props.label}>
      <div className={line}>
        <span className={lineButton}>
          <span className={gutter} aria-hidden="true">
            {" "}
          </span>
          <span className={glyph} aria-hidden="true">
            {props.glyph}
          </span>
          <span className={control}>{props.label}</span>
        </span>
      </div>
      <Lines
        entries={props.entries}
        prefix={props.childPrefix}
        root={false}
        services={props.services}
        expansion={props.expansion}
      />
    </div>
  );
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
  args: style({
    color: colors.gray[9],
    flex: "0 0 auto",
  }),
  location: style({
    marginLeft: spacing.value(4),
    color: colors.gray[10],
    fontSize: "11px",
    flex: "0 0 auto",
  }),
  returns: style({
    marginLeft: spacing.value(4),
    color: colors.gray[10],
    fontSize: "11px",
    flex: "0 0 auto",
  }),
  replyFrom: style({
    margin: `0 ${spacing.value(1)}`,
    color: colors.gray[10],
    fontSize: "11px",
    flex: "0 0 auto",
  }),
  control: style({
    color: colors.gray[11],
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
