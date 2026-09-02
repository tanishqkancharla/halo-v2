import { Badge, colors, flex, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { ProgramEvent } from "../model/Program.js";
import { carrierIcons, carrierLabels } from "./carriers.tsx";

type EventDirection = "in" | "hop" | "out";

const directionLabels = {
  in: "in",
  hop: "then",
  out: "out",
} satisfies Record<EventDirection, string>;

export function EventRow(props: {
  direction: EventDirection;
  event: ProgramEvent;
}) {
  const Icon = carrierIcons[props.event.carrier];
  const row = useStyles(
    styles.row,
    props.direction === "hop" ? styles.hopRow : undefined,
  );
  const direction = useStyles(
    styles.direction,
    props.direction === "in" ? styles.directionIn : undefined,
    props.direction === "out" ? styles.directionOut : undefined,
  );
  const name = useStyles(styles.name);
  const detail = useStyles(styles.detail);
  const icon = useStyles(styles.icon);

  return (
    <div className={row} data-flowstack-event={props.direction}>
      <span className={direction}>{directionLabels[props.direction]}</span>
      <span className={icon}>
        <Icon size="xs" />
      </span>
      <Badge>{carrierLabels[props.event.carrier]}</Badge>
      <span className={name}>{props.event.name}</span>
      {props.event.detail === undefined ? undefined : (
        <span className={detail}>{props.event.detail}</span>
      )}
    </div>
  );
}

const styles = {
  row: style(
    flex({ direction: "row", align: "center", gap: 3, wrap: true }),
    spacing.padding({ x: 3, y: 2 }),
    {
      minWidth: 0,
    },
  ),
  hopRow: style({
    opacity: 0.85,
  }),
  direction: style(
    text({ size: "2xs", fontWeight: 600, color: "lowContrast" }),
    {
      width: "34px",
      flex: "0 0 auto",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    },
  ),
  directionIn: style({
    color: colors.green[11],
  }),
  directionOut: style({
    color: colors.orange[11],
  }),
  icon: style({
    display: "inline-flex",
    color: colors.gray[11],
  }),
  name: style(text({ size: "sm", fontWeight: 500, color: "highContrast" }), {
    minWidth: 0,
  }),
  detail: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" }), {
    minWidth: 0,
  }),
};
