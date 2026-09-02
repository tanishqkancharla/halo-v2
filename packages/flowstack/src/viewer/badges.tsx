import { Badge, colors, radius } from "maui";
import { style, useStyles } from "purse-styles";
import type { ProcessName, Service, StateField } from "../model/Program.js";
import { processLabels } from "./carriers.tsx";

const processStyles = {
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

const processText = {
  renderer: style({ color: colors.blue[11] }),
  preload: style({ color: colors.violet[11] }),
  main: style({ color: colors.grass[11] }),
  outside: style({ color: colors.gray[11] }),
} satisfies Record<ProcessName, ReturnType<typeof style>>;

export function serviceProcess(service: Service | undefined): ProcessName {
  return service === undefined ? "outside" : service.process;
}

/** A service name in its service's colour, no chip. */
export function ActorText(props: { service: Service | undefined; id: string }) {
  const actor = useStyles(
    actorStyle,
    processText[serviceProcess(props.service)],
  );
  return (
    <span className={actor}>
      {props.service === undefined ? props.id : props.service.name}
    </span>
  );
}

const actorStyle = style({
  fontWeight: 600,
});

const classPattern = /^([A-Za-z_$][\w$]*)(\..*)$/;

/**
 * A frame or event name with its class segment in the owning service's
 * colour: `sessions` in `sessions.prompt`. Names without a class take the
 * colour whole.
 */
export function NameText(props: { name: string; process: ProcessName }) {
  const coloured = useStyles(nameStyle, processText[props.process]);
  const rest = useStyles(nameRest);
  const match = classPattern.exec(props.name);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return <span className={coloured}>{props.name}</span>;
  }
  return (
    <span className={rest}>
      <span className={coloured}>{match[1]}</span>
      {match[2]}
    </span>
  );
}

const nameStyle = style({
  fontWeight: 600,
});

const nameRest = style({
  color: colors.gray[12],
  fontWeight: 500,
});

export function StateChip(props: { field: StateField }) {
  const chip = useStyles(stateChipStyle);
  return (
    <span className={chip} title={`${props.field.name}: ${props.field.type}`}>
      {props.field.name}
    </span>
  );
}

const stateChipStyle = style(radius.xs, {
  display: "inline-block",
  fontFamily:
    'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: "10.5px",
  lineHeight: "14px",
  paddingInline: "4px",
  color: colors.amber[11],
  backgroundColor: colors.amberAlpha[3],
  whiteSpace: "nowrap",
});
