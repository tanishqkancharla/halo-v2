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
import type {
  Frame,
  Path,
  ProcessName,
  Service,
  StateField,
} from "../model/Program.js";
import { EventRow } from "./EventRow.tsx";
import { processLabels } from "./carriers.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

export type Expansion = {
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
};

export function frameKeys(path: Path, parentKey = ""): string[] {
  const keys: string[] = [];
  path.forEach((step, index) => {
    if (step.kind !== "frame") return;
    const key = `${parentKey}/${index}`;
    if (step.frame.inner === undefined) return;
    keys.push(key, ...frameKeys(step.frame.inner, key));
  });
  return keys;
}

export function PathStack(props: {
  path: Path;
  services: Map<string, Service>;
  expansion: Expansion;
  parentKey?: string;
}) {
  const parentKey = props.parentKey === undefined ? "" : props.parentKey;
  const list = useStyles(styles.list);
  return (
    <div className={list}>
      {props.path.map((step, index) => {
        const key = `${parentKey}/${index}`;
        if (step.kind === "frame") {
          return (
            <FrameRow
              key={key}
              frameKey={key}
              frame={step.frame}
              services={props.services}
              expansion={props.expansion}
            />
          );
        }
        return <EventRow key={key} direction={step.kind} event={step.event} />;
      })}
    </div>
  );
}

function FrameRow(props: {
  frameKey: string;
  frame: Frame;
  services: Map<string, Service>;
  expansion: Expansion;
}) {
  const { frame, frameKey, expansion } = props;
  const service = props.services.get(frame.service);
  const sourceKey = `${frameKey}#src`;
  const hasInner = frame.inner !== undefined;
  const innerOpen = hasInner && expansion.isExpanded(frameKey);
  const sourceOpen =
    frame.source !== undefined && expansion.isExpanded(sourceKey);
  const canOpen = hasInner || frame.source !== undefined;
  const primaryKey = hasInner ? frameKey : sourceKey;
  const primaryOpen = hasInner ? innerOpen : sourceOpen;

  const shell = useStyles(styles.frame);
  const row = useStyles(styles.row, canOpen ? styles.rowClickable : undefined);
  const rowButton = useStyles(styles.rowButton);
  const chevron = useStyles(styles.chevron);
  const entry = useStyles(styles.entry);
  const summary = useStyles(styles.summary);
  const stateList = useStyles(styles.stateList);
  const sourceButton = useStyles(
    styles.sourceButton,
    sourceOpen ? styles.sourceButtonOpen : undefined,
  );
  const children = useStyles(styles.children);
  const sourceBlock = useStyles(styles.sourceBlock);

  return (
    <div className={shell} data-flowstack-frame={frame.service}>
      <div className={row}>
        <button
          type="button"
          className={rowButton}
          disabled={!canOpen}
          aria-expanded={canOpen ? primaryOpen : undefined}
          onClick={() => expansion.toggle(primaryKey)}
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
          {service === undefined ? undefined : (
            <ProcessBadge process={service.process} />
          )}
          <span className={entry}>{frame.entry}</span>
          {frame.summary === undefined ? undefined : (
            <span className={summary}>{frame.summary}</span>
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
        {frame.source === undefined || !hasInner ? undefined : (
          <button
            type="button"
            className={sourceButton}
            aria-pressed={sourceOpen}
            title={`${frame.source.path}:${frame.source.start}-${frame.source.end}`}
            onClick={() => expansion.toggle(sourceKey)}
          >
            <Code size="xs" />
          </button>
        )}
      </div>
      {sourceOpen && frame.source !== undefined ? (
        <div className={sourceBlock}>
          <SourceExcerpt source={frame.source} />
        </div>
      ) : undefined}
      {innerOpen && frame.inner !== undefined ? (
        <div className={children}>
          <PathStack
            path={frame.inner}
            services={props.services}
            expansion={expansion}
            parentKey={frameKey}
          />
        </div>
      ) : undefined}
    </div>
  );
}

const processStyles = {
  app: style({
    backgroundColor: colors.accentAlpha[3],
    color: colors.accent[11],
  }),
  renderer: style({
    backgroundColor: colors.blueAlpha[3],
    color: colors.blue[11],
  }),
  preload: style({
    backgroundColor: colors.violetAlpha[3],
    color: colors.violet[11],
  }),
  main: style({
    backgroundColor: colors.grassAlpha[3],
    color: colors.grass[11],
  }),
  outside: style({
    backgroundColor: colors.grayAlpha[3],
    color: colors.gray[11],
  }),
} satisfies Record<ProcessName, ReturnType<typeof style>>;

export function ProcessBadge(props: { process: ProcessName }) {
  const badge = useStyles(processStyles[props.process]);
  return <Badge className={badge}>{processLabels[props.process]}</Badge>;
}

export function StateChip(props: { field: StateField }) {
  const chip = useStyles(styles.stateChip);
  return (
    <span className={chip} title={`${props.field.name}: ${props.field.type}`}>
      {props.field.name}
    </span>
  );
}

const styles = {
  list: style(flex({ direction: "column" }), {
    minWidth: 0,
  }),
  frame: style(flex({ direction: "column" }), {
    minWidth: 0,
  }),
  row: style(
    flex({ direction: "row", align: "center", gap: 3, wrap: true }),
    radius.sm,
    spacing.padding({ right: 3 }),
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
    spacing.padding({ x: 2, y: 2 }),
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
  entry: style(text({ size: "sm", fontWeight: 500, color: "highContrast" }), {
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: "12.5px",
    minWidth: 0,
  }),
  summary: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" }), {
    minWidth: 0,
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
  stateChip: style(radius.xs, {
    display: "inline-block",
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: "10.5px",
    lineHeight: "14px",
    paddingInline: "4px",
    color: colors.amber[11],
    backgroundColor: colors.amberAlpha[3],
    whiteSpace: "nowrap",
  }),
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
  children: style(spacing.padding({ left: 4 }), {
    marginLeft: "13px",
    borderLeft: `1px solid ${colors.gray[6]}`,
    minWidth: 0,
  }),
  sourceBlock: style(spacing.padding({ y: 2, right: 2 }), {
    marginLeft: "26px",
    minWidth: 0,
  }),
};
