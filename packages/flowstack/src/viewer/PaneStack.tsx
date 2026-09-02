import { useRef, useState } from "react";
import {
  Badge,
  backgroundColor,
  colors,
  flex,
  radius,
  spacing,
  text,
} from "maui";
import { ArrowRight, ChevronRight } from "maui/icons";
import { style, useStyles } from "purse-styles";
import {
  keyed,
  type Flow,
  type FlowNode,
  type Keyed,
  type Service,
} from "../model/Program.js";
import { ActorBadge, ProcessBadge, StateChip } from "./badges.tsx";
import { carrierLabels } from "./carriers.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

const paneWidth = 560;
const stripWidth = 40;

/**
 * Sliding panes, after Andy Matuschak's notes: the flow is the first pane,
 * and each node you click opens to the right. Earlier panes stick to the
 * left edge and collapse to a title strip as later ones slide over them.
 */
export function PaneStack(props: {
  flow: Flow;
  services: Map<string, Service>;
}) {
  const [open, setOpen] = useState<Keyed[]>([]);
  const container = useRef<HTMLDivElement>(null);

  function openNode(depth: number, next: Keyed) {
    setOpen((current) => [...current.slice(0, depth), next]);
    // The new pane exists after React commits; scroll on the next frame.
    requestAnimationFrame(() => {
      const element = container.current;
      if (element === null) return;
      element.scrollTo({ left: element.scrollWidth, behavior: "smooth" });
    });
  }

  function scrollToPane(index: number) {
    const element = container.current;
    if (element === null) return;
    element.scrollTo({
      left: index * (paneWidth - stripWidth),
      behavior: "smooth",
    });
  }

  const shell = useStyles(styles.shell);
  return (
    <div ref={container} className={shell}>
      <Pane
        index={0}
        title={props.flow.title}
        onFocusPane={() => scrollToPane(0)}
      >
        <PaneDescription text={props.flow.description} />
        <PaneRows
          items={keyed(props.flow.children, props.flow.id)}
          services={props.services}
          selectedKey={open[0]?.key}
          onOpen={(next) => openNode(0, next)}
        />
      </Pane>
      {open.map((entry, index) => (
        <NodePane
          key={entry.key}
          index={index + 1}
          entry={entry}
          services={props.services}
          selectedKey={open[index + 1]?.key}
          onOpen={(next) => openNode(index + 1, next)}
          onFocusPane={() => scrollToPane(index + 1)}
        />
      ))}
    </div>
  );
}

function nodeTitle(node: FlowNode) {
  return node.kind === "event" ? node.name : node.entry;
}

function NodePane(props: {
  index: number;
  entry: Keyed;
  services: Map<string, Service>;
  selectedKey: string | undefined;
  onOpen: (next: Keyed) => void;
  onFocusPane: () => void;
}) {
  const { node, key } = props.entry;
  const meta = useStyles(styles.meta);
  const arrow = useStyles(styles.arrow);
  const stateList = useStyles(styles.stateList);
  const sectionLabel = useStyles(styles.sectionLabel);
  const sourceBlock = useStyles(styles.sourceBlock);
  const service =
    node.kind === "frame" ? props.services.get(node.service) : undefined;
  return (
    <Pane
      index={props.index}
      title={nodeTitle(node)}
      onFocusPane={props.onFocusPane}
    >
      {node.kind === "event" ? (
        <div className={meta}>
          <ActorBadge service={props.services.get(node.from)} id={node.from} />
          <span className={arrow} aria-hidden="true">
            <ArrowRight size="xs" />
          </span>
          <ActorBadge service={props.services.get(node.to)} id={node.to} />
          <Badge>{carrierLabels[node.carrier]}</Badge>
        </div>
      ) : (
        <div className={meta}>
          {service === undefined ? undefined : (
            <ProcessBadge process={service.process} />
          )}
          {service === undefined || service.state.length === 0 ? undefined : (
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
      {node.kind === "event" && node.detail !== undefined ? (
        <PaneDescription text={node.detail} />
      ) : undefined}
      {node.kind === "frame" && node.summary !== undefined ? (
        <PaneDescription text={node.summary} />
      ) : undefined}
      {node.children.length === 0 ? undefined : (
        <>
          <div className={sectionLabel}>
            {node.kind === "event" ? "Handled by" : "Calls"}
          </div>
          <PaneRows
            items={keyed(node.children, key)}
            services={props.services}
            selectedKey={props.selectedKey}
            onOpen={props.onOpen}
          />
        </>
      )}
      {node.kind === "frame" && node.source !== undefined ? (
        <>
          <div className={sectionLabel}>Source</div>
          <div className={sourceBlock}>
            <SourceExcerpt source={node.source} />
          </div>
        </>
      ) : undefined}
    </Pane>
  );
}

function Pane(props: {
  index: number;
  title: string;
  onFocusPane: () => void;
  children: React.ReactNode;
}) {
  const pane = useStyles(styles.pane);
  const strip = useStyles(styles.strip);
  const stripTitle = useStyles(styles.stripTitle);
  const content = useStyles(styles.content);
  const heading = useStyles(styles.heading);
  return (
    <section
      className={pane}
      style={{ left: props.index * stripWidth, zIndex: props.index }}
      aria-label={props.title}
      data-flowstack-pane={props.index}
    >
      <button
        type="button"
        className={strip}
        title={`Scroll to ${props.title}`}
        onClick={props.onFocusPane}
      >
        <span className={stripTitle}>{props.title}</span>
      </button>
      <div className={content}>
        <h2 className={heading}>{props.title}</h2>
        {props.children}
      </div>
    </section>
  );
}

function PaneDescription(props: { text: string }) {
  const description = useStyles(styles.description);
  return <p className={description}>{props.text}</p>;
}

function PaneRows(props: {
  items: Keyed[];
  services: Map<string, Service>;
  selectedKey: string | undefined;
  onOpen: (next: Keyed) => void;
}) {
  const list = useStyles(styles.rows);
  return (
    <div className={list}>
      {props.items.map((item) => (
        <PaneRow
          key={item.key}
          item={item}
          services={props.services}
          selected={props.selectedKey === item.key}
          onOpen={() => props.onOpen(item)}
        />
      ))}
    </div>
  );
}

function PaneRow(props: {
  item: Keyed;
  services: Map<string, Service>;
  selected: boolean;
  onOpen: () => void;
}) {
  const { node } = props.item;
  const canOpen =
    node.children.length > 0 ||
    (node.kind === "frame" && node.source !== undefined);
  const row = useStyles(
    styles.row,
    canOpen ? styles.rowClickable : undefined,
    props.selected ? styles.rowSelected : undefined,
  );
  const entry = useStyles(styles.entry);
  const name = useStyles(styles.eventName);
  const summary = useStyles(styles.summary);
  const arrow = useStyles(styles.arrow);
  const chevron = useStyles(styles.chevron);
  const service =
    node.kind === "frame" ? props.services.get(node.service) : undefined;
  return (
    <button
      type="button"
      className={row}
      disabled={!canOpen}
      aria-current={props.selected ? "true" : undefined}
      onClick={props.onOpen}
    >
      {node.kind === "event" ? (
        <>
          <ActorBadge service={props.services.get(node.from)} id={node.from} />
          <span className={arrow} aria-hidden="true">
            <ArrowRight size="xs" />
          </span>
          <ActorBadge service={props.services.get(node.to)} id={node.to} />
          <span className={name}>{node.name}</span>
          {node.detail === undefined ? undefined : (
            <span className={summary}>{node.detail}</span>
          )}
        </>
      ) : (
        <>
          {service === undefined ? undefined : (
            <ProcessBadge process={service.process} />
          )}
          <span className={entry}>{node.entry}</span>
          {node.summary === undefined ? undefined : (
            <span className={summary}>{node.summary}</span>
          )}
        </>
      )}
      {canOpen ? (
        <span className={chevron} aria-hidden="true">
          <ChevronRight size="xs" />
        </span>
      ) : undefined}
    </button>
  );
}

const monospace =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const styles = {
  shell: style(flex({ direction: "row" }), {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "hidden",
    backgroundColor: colors.gray[2],
  }),
  pane: style(flex({ direction: "row" }), {
    position: "sticky",
    flex: "0 0 auto",
    width: `${paneWidth}px`,
    height: "100%",
    minHeight: 0,
    backgroundColor: backgroundColor.element,
    borderRight: `1px solid ${colors.gray[5]}`,
    boxShadow: "-6px 0 14px rgba(0, 0, 0, 0.06)",
  }),
  strip: style({
    flex: "0 0 auto",
    width: `${stripWidth}px`,
    height: "100%",
    margin: 0,
    padding: 0,
    border: 0,
    borderRight: `1px solid ${colors.gray[4]}`,
    background: colors.gray[2],
    color: colors.gray[11],
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    "&:hover": {
      background: colors.gray[3],
      color: colors.gray[12],
    },
  }),
  stripTitle: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
    {
      writingMode: "vertical-rl",
      paddingTop: spacing.value(4),
      fontFamily: monospace,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxHeight: "100%",
    },
  ),
  content: style(
    flex({ direction: "column", gap: 4 }),
    spacing.padding({ x: 6, y: 4 }),
    {
      flex: "1 1 auto",
      minWidth: 0,
      minHeight: 0,
      overflowY: "auto",
    },
  ),
  heading: style(text({ size: "lg", fontWeight: 600, color: "highContrast" }), {
    margin: 0,
    fontFamily: monospace,
    fontSize: "16px",
    overflowWrap: "anywhere",
  }),
  description: style(
    text({ size: "sm", fontWeight: 400, color: "lowContrast" }),
    {
      margin: 0,
    },
  ),
  meta: style(flex({ direction: "row", align: "center", gap: 2, wrap: true })),
  arrow: style({
    display: "inline-flex",
    color: colors.gray[9],
  }),
  stateList: style(
    flex({ direction: "row", align: "center", gap: 1, wrap: true }),
    {
      listStyle: "none",
      margin: 0,
      padding: 0,
    },
  ),
  sectionLabel: style(
    text({ size: "2xs", fontWeight: 600, color: "lowContrast" }),
    {
      marginTop: spacing.value(2),
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    },
  ),
  rows: style(flex({ direction: "column" }), radius.md, {
    minWidth: 0,
    border: `1px solid ${colors.gray[5]}`,
    paddingBlock: spacing.value(1),
  }),
  row: style(
    flex({ direction: "row", align: "center", gap: 2, wrap: true }),
    spacing.padding({ x: 3, y: 2 }),
    {
      width: "100%",
      minWidth: 0,
      margin: 0,
      border: 0,
      background: "transparent",
      color: "inherit",
      font: "inherit",
      textAlign: "left",
      cursor: "default",
      "&:focus-visible": {
        outline: `2px solid ${colors.accent[8]}`,
        outlineOffset: "-2px",
      },
    },
  ),
  rowClickable: style({
    cursor: "pointer",
    "&:hover": {
      backgroundColor: backgroundColor.elementHover,
    },
  }),
  rowSelected: style({
    backgroundColor: colors.accentAlpha[3],
    "&:hover": {
      backgroundColor: colors.accentAlpha[4],
    },
  }),
  entry: style(text({ size: "sm", fontWeight: 500, color: "highContrast" }), {
    fontFamily: monospace,
    fontSize: "12.5px",
    minWidth: 0,
  }),
  eventName: style(
    text({ size: "sm", fontWeight: 500, color: "highContrast" }),
    {
      minWidth: 0,
    },
  ),
  summary: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" }), {
    minWidth: 0,
  }),
  chevron: style({
    display: "inline-flex",
    marginLeft: "auto",
    color: colors.gray[10],
    flex: "0 0 auto",
  }),
  sourceBlock: style({
    minWidth: 0,
  }),
};
