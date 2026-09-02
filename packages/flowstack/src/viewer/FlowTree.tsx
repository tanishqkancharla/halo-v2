import {
  Badge,
  backgroundColor,
  colors,
  flex,
  radius,
  spacing,
  text,
} from "maui";
import { ChevronDown, ChevronRight, Code } from "maui/icons";
import { style, useStyles } from "purse-styles";
import {
  eventChildren,
  keyed,
  type EventNode,
  type FlowNode,
  type FrameNode,
  type Keyed,
  type Service,
} from "../model/Program.js";
import { NameText, serviceProcess, StateChip } from "./badges.tsx";
import { carrierIcons, carrierLabels } from "./carriers.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

/**
 * `events` hides frames and hoists the events inside them. `code` shows the
 * frames too. `source` also opens every frame's excerpt.
 */
export type TreeLevel = "events" | "code" | "source";

export type Expansion = {
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
  open: (keys: string[]) => void;
};

export function sourceKey(key: string) {
  return `${key}#src`;
}

/**
 * The keys to open when a node opens: the node, then every node down a
 * run of single children until it branches. A leaf frame at the end
 * opens its source too.
 */
function chainKeys(item: Keyed, level: TreeLevel): string[] {
  const keys = [item.key];
  let current = item;
  for (;;) {
    const children = visibleChildren(current.node, current.key, level);
    if (children.length === 0) {
      if (current.node.kind === "frame" && current.node.source !== undefined) {
        keys.push(sourceKey(current.key));
      }
      return keys;
    }
    const only = children[0];
    if (children.length !== 1 || only === undefined) return keys;
    keys.push(only.key);
    current = only;
  }
}

/** Collapse when open; otherwise open the node and walk its single-child chain. */
export function toggleChain(
  expansion: Expansion,
  item: Keyed,
  level: TreeLevel,
) {
  if (expansion.isExpanded(item.key)) {
    expansion.toggle(item.key);
    return;
  }
  expansion.open(chainKeys(item, level));
}

function visibleChildren(
  node: FlowNode,
  key: string,
  level: TreeLevel,
): Keyed[] {
  if (level === "events") return eventChildren(node.children, key);
  return keyed(node.children, key);
}

export function FlowTree(props: {
  nodes: FlowNode[];
  parentKey: string;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  const items =
    props.level === "events"
      ? eventChildren(props.nodes, props.parentKey)
      : keyed(props.nodes, props.parentKey);
  const list = useStyles(styles.list);
  return (
    <div className={list}>
      {items.map((item) =>
        item.node.kind === "event" ? (
          <EventRow
            key={item.key}
            nodeKey={item.key}
            node={item.node}
            services={props.services}
            level={props.level}
            expansion={props.expansion}
          />
        ) : (
          <FrameRow
            key={item.key}
            nodeKey={item.key}
            node={item.node}
            services={props.services}
            level={props.level}
            expansion={props.expansion}
          />
        ),
      )}
    </div>
  );
}

function EventRow(props: {
  nodeKey: string;
  node: EventNode;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  const { node, nodeKey, expansion } = props;
  const children = visibleChildren(node, nodeKey, props.level);
  const canOpen = children.length > 0;
  const open = canOpen && expansion.isExpanded(nodeKey);
  const Icon = carrierIcons[node.carrier];

  const shell = useStyles(styles.node);
  const row = useStyles(styles.row, canOpen ? styles.rowClickable : undefined);
  const rowButton = useStyles(styles.rowButton);
  const chevron = useStyles(styles.chevron);
  const name = useStyles(styles.eventName);
  const detail = useStyles(styles.detail);
  const carrier = useStyles(styles.carrier);
  const childrenShell = useStyles(styles.children);

  return (
    <div className={shell} data-flowstack-event={node.name}>
      <div className={row}>
        <button
          type="button"
          className={rowButton}
          disabled={!canOpen}
          aria-expanded={canOpen ? open : undefined}
          onClick={() =>
            toggleChain(expansion, { key: nodeKey, node }, props.level)
          }
        >
          <span className={chevron} aria-hidden="true">
            {canOpen ? (
              open ? (
                <ChevronDown size="xs" />
              ) : (
                <ChevronRight size="xs" />
              )
            ) : undefined}
          </span>
          <span className={name}>
            <NameText
              name={node.name}
              process={serviceProcess(props.services.get(node.from))}
            />
          </span>
          {node.detail === undefined ? undefined : (
            <span className={detail}>{node.detail}</span>
          )}
        </button>
        <span className={carrier} title={carrierLabels[node.carrier]}>
          <Icon size="xs" />
          <Badge>{carrierLabels[node.carrier]}</Badge>
        </span>
      </div>
      {open ? (
        <div className={childrenShell}>
          <FlowTree
            nodes={node.children}
            parentKey={nodeKey}
            services={props.services}
            level={props.level}
            expansion={expansion}
          />
        </div>
      ) : undefined}
    </div>
  );
}

function FrameRow(props: {
  nodeKey: string;
  node: FrameNode;
  services: Map<string, Service>;
  level: TreeLevel;
  expansion: Expansion;
}) {
  const { node, nodeKey, expansion } = props;
  const service = props.services.get(node.service);
  const hasChildren = node.children.length > 0;
  const hasSource = node.source !== undefined;
  const childrenOpen = hasChildren && expansion.isExpanded(nodeKey);
  const sourceOpen =
    hasSource &&
    (props.level === "source" || expansion.isExpanded(sourceKey(nodeKey)));
  const primaryKey = hasChildren ? nodeKey : sourceKey(nodeKey);
  const primaryOpen = hasChildren ? childrenOpen : sourceOpen;
  const canOpen = hasChildren || hasSource;

  const shell = useStyles(styles.node);
  const row = useStyles(styles.row, canOpen ? styles.rowClickable : undefined);
  const rowButton = useStyles(styles.rowButton);
  const chevron = useStyles(styles.chevron);
  const entry = useStyles(styles.entry);
  const summary = useStyles(styles.detail);
  const stateList = useStyles(styles.stateList);
  const sourceButton = useStyles(
    styles.sourceButton,
    sourceOpen ? styles.sourceButtonOpen : undefined,
  );
  const childrenShell = useStyles(styles.children);
  const sourceBlock = useStyles(styles.sourceBlock);

  return (
    <div className={shell} data-flowstack-frame={node.service}>
      <div className={row}>
        <button
          type="button"
          className={rowButton}
          disabled={!canOpen}
          aria-expanded={canOpen ? primaryOpen : undefined}
          onClick={() =>
            hasChildren
              ? toggleChain(expansion, { key: nodeKey, node }, props.level)
              : expansion.toggle(primaryKey)
          }
        >
          <span className={chevron} aria-hidden="true">
            {canOpen ? (
              primaryOpen ? (
                <ChevronDown size="xs" />
              ) : (
                <ChevronRight size="xs" />
              )
            ) : undefined}
          </span>
          <span className={entry}>
            <NameText name={node.entry} process={serviceProcess(service)} />
          </span>
          {node.summary === undefined ? undefined : (
            <span className={summary}>{node.summary}</span>
          )}
        </button>
        {service === undefined || service.state.length === 0 ? undefined : (
          <ul className={stateList} aria-label={`${service.name} state`}>
            {service.state.map((field) => (
              <li key={field.name}>
                <StateChip field={field} />
              </li>
            ))}
          </ul>
        )}
        {hasSource && hasChildren ? (
          <button
            type="button"
            className={sourceButton}
            aria-pressed={sourceOpen}
            title={`${node.source?.path}:${node.source?.start}-${node.source?.end}`}
            onClick={() => expansion.toggle(sourceKey(nodeKey))}
          >
            <Code size="xs" />
          </button>
        ) : undefined}
      </div>
      {sourceOpen && node.source !== undefined ? (
        <div className={sourceBlock}>
          <SourceExcerpt source={node.source} />
        </div>
      ) : undefined}
      {childrenOpen ? (
        <div className={childrenShell}>
          <FlowTree
            nodes={node.children}
            parentKey={nodeKey}
            services={props.services}
            level={props.level}
            expansion={expansion}
          />
        </div>
      ) : undefined}
    </div>
  );
}

const monospace =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const styles = {
  list: style(flex({ direction: "column", gap: 1 }), {
    minWidth: 0,
  }),
  node: style(flex({ direction: "column" }), {
    minWidth: 0,
  }),
  row: style(
    flex({ direction: "row", align: "center", gap: 4, wrap: true }),
    radius.sm,
    spacing.padding({ right: 4 }),
    {
      minWidth: 0,
    },
  ),
  rowClickable: style({
    "&:hover": {
      backgroundColor: backgroundColor.elementHover,
    },
  }),
  rowButton: style(
    flex({ direction: "row", align: "center", gap: 3, wrap: true }),
    spacing.padding({ x: 2, y: 3 }),
    {
      flex: "1 1 auto",
      minWidth: 0,
      margin: 0,
      border: 0,
      background: "transparent",
      color: "inherit",
      font: "inherit",
      textAlign: "left",
      cursor: "pointer",
      "&:disabled": {
        cursor: "default",
      },
      "&:focus-visible": {
        outline: `2px solid ${colors.accent[8]}`,
        outlineOffset: "-2px",
        borderRadius: "4px",
      },
    },
  ),
  chevron: style({
    display: "inline-flex",
    width: "16px",
    justifyContent: "center",
    color: colors.gray[10],
    flex: "0 0 auto",
  }),
  eventName: style(
    text({ size: "sm", fontWeight: 500, color: "highContrast" }),
    {
      minWidth: 0,
      marginLeft: spacing.value(1),
    },
  ),
  entry: style(text({ size: "sm", fontWeight: 500, color: "highContrast" }), {
    fontFamily: monospace,
    fontSize: "12.5px",
    minWidth: 0,
  }),
  detail: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" }), {
    minWidth: 0,
  }),
  carrier: style(flex({ direction: "row", align: "center", gap: 1 }), {
    color: colors.gray[10],
    flex: "0 0 auto",
  }),
  stateList: style(
    flex({ direction: "row", align: "center", gap: 1, wrap: true }),
    {
      listStyle: "none",
      margin: 0,
      marginLeft: "auto",
      padding: 0,
      flex: "0 1 auto",
      justifyContent: "flex-end",
    },
  ),
  sourceButton: style(radius.sm, {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px",
    margin: 0,
    border: 0,
    background: "transparent",
    color: colors.gray[10],
    cursor: "pointer",
    "&:hover": {
      color: colors.gray[12],
      backgroundColor: colors.grayAlpha[3],
    },
  }),
  sourceButtonOpen: style({
    color: colors.accent[11],
    backgroundColor: colors.accentAlpha[3],
  }),
  children: style(spacing.padding({ left: 6 }), {
    marginLeft: "15px",
    borderLeft: `1px solid ${colors.gray[5]}`,
    minWidth: 0,
  }),
  sourceBlock: style(spacing.padding({ y: 2, right: 2 }), {
    marginLeft: "26px",
    minWidth: 0,
  }),
};
