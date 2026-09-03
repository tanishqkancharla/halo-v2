import { backgroundColor, colors, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import {
  eventChildren,
  type EventNode,
  type FlowNode,
  type Service,
} from "../model/Program.js";
import { NameText, serviceProcess } from "./badges.tsx";
import { carrierIcons, carrierLabels } from "./carriers.tsx";

/**
 * The flow at the level of its main services: only the events, nested as
 * they cause one another, each name coloured by the service that sends it.
 * Frames are folded away, so an event that a frame sends sits under the
 * event that frame handled. Clicking an event opens the path to it in the
 * call stack.
 */
export function FlowOverview(props: {
  nodes: FlowNode[];
  parentKey: string;
  services: Map<string, Service>;
  onReveal: (key: string) => void;
}) {
  const block = useStyles(styles.block);
  return (
    <div className={block} data-flowstack-overview>
      <Rows
        items={eventChildren(props.nodes, props.parentKey)}
        prefix=""
        root
        services={props.services}
        onReveal={props.onReveal}
      />
    </div>
  );
}

function Rows(props: {
  items: { key: string; node: EventNode }[];
  prefix: string;
  root: boolean;
  services: Map<string, Service>;
  onReveal: (key: string) => void;
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
          <Row
            key={item.key}
            eventKey={item.key}
            node={item.node}
            glyph={`${props.prefix}${glyph}`}
            childPrefix={childPrefix}
            services={props.services}
            onReveal={props.onReveal}
          />
        );
      })}
    </>
  );
}

function Row(props: {
  eventKey: string;
  node: EventNode;
  glyph: string;
  childPrefix: string;
  services: Map<string, Service>;
  onReveal: (key: string) => void;
}) {
  const { node } = props;
  const Icon = carrierIcons[node.carrier];

  const row = useStyles(styles.row);
  const glyph = useStyles(styles.glyph);
  const carrier = useStyles(styles.carrier);

  return (
    <div data-flowstack-overview-event={node.name}>
      <button
        type="button"
        className={row}
        title="Open in the call stack"
        onClick={() => props.onReveal(props.eventKey)}
      >
        <span className={glyph} aria-hidden="true">
          {props.glyph}
        </span>
        <NameText
          name={node.name}
          process={serviceProcess(props.services.get(node.from))}
        />
        <span className={carrier}>
          <Icon size="xs" />
          {carrierLabels[node.carrier]}
        </span>
      </button>
      <Rows
        items={eventChildren(node.children, props.eventKey)}
        prefix={props.childPrefix}
        root={false}
        services={props.services}
        onReveal={props.onReveal}
      />
    </div>
  );
}

const styles = {
  block: style(radius.md, spacing.padding({ y: 3, x: 4 }), {
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: "13px",
    lineHeight: "30px",
    border: `1px solid ${colors.gray[5]}`,
    backgroundColor: backgroundColor.element,
    overflowX: "auto",
    minWidth: 0,
  }),
  row: style({
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
    cursor: "pointer",
    "&:hover": {
      backgroundColor: backgroundColor.elementHover,
    },
    "&:focus-visible": {
      outline: `2px solid ${colors.accent[8]}`,
      outlineOffset: "-2px",
    },
  }),
  glyph: style({
    color: colors.gray[7],
    flex: "0 0 auto",
  }),
  carrier: style({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing.value(1),
    marginLeft: spacing.value(4),
    color: colors.gray[10],
    fontSize: "11px",
    flex: "0 0 auto",
  }),
};
