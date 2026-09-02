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

/** A service name coloured by its process; unknown ids fall in `outside`. */
export function ActorBadge(props: {
  service: Service | undefined;
  id: string;
}) {
  const process =
    props.service === undefined ? "outside" : props.service.process;
  const badge = useStyles(processStyles[process], actorStyle);
  return (
    <Badge className={badge}>
      {props.service === undefined ? props.id : props.service.name}
    </Badge>
  );
}

const actorStyle = style({
  fontWeight: 600,
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
