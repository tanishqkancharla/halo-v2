import { colors, monospace, prose } from "maui";
import { style, useStyles } from "purse-styles";
import {
  toolPartLabel,
  type SessionViewPart,
} from "../agentSession/sessionView.ts";

type ToolPart = Extract<SessionViewPart, { kind: "tool" }>;

export function ToolCall({ part }: { part: ToolPart }) {
  const label = toolPartLabel(part);
  const labelClassName = useStyles(styles.label);
  const shellClassName = useStyles(styles.shell);

  const summary =
    label.kind === "read" ? (
      <>Read {label.text}</>
    ) : label.kind === "wrote" ? (
      <>Wrote {label.text}</>
    ) : label.kind === "shell" ? (
      <>
        {"$ "}
        <span className={shellClassName}>{label.text}</span>
      </>
    ) : (
      <>{label.text}</>
    );

  return <div className={labelClassName}>{summary}</div>;
}

const labelStyle = style(prose("sm").paragraph, {
  color: colors.gray[11],
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const styles = {
  label: labelStyle,
  shell: style(monospace),
};
