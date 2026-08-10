import { useState } from "react";
import {
  CodeBlock,
  colors,
  flex,
  monospace,
  prose,
  radius,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  execJsSource,
  toolPartLabel,
  type SessionViewPart,
} from "../agentSession/sessionView.ts";

type ToolPart = Extract<SessionViewPart, { kind: "tool" }>;

export function ToolCall({ part }: { part: ToolPart }) {
  const label = toolPartLabel(part);
  const [expanded, setExpanded] = useState(false);
  const rootClassName = useStyles(
    styles.root,
    expanded ? styles.rootExpanded : undefined,
  );
  const labelClassName = useStyles(styles.label);
  const summaryClassName = useStyles(styles.summary);
  const shellClassName = useStyles(styles.shell);
  const bodyClassName = useStyles(styles.body);
  const outputClassName = useStyles(styles.output);
  const js = label.kind === "exec" ? execJsSource(part.args) : undefined;
  const expandable = label.kind === "exec" && js !== undefined;

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

  if (!expandable) {
    return <div className={labelClassName}>{summary}</div>;
  }

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className={summaryClassName}
        aria-expanded={expanded}
        aria-label={label.text}
        onClick={() => setExpanded(!expanded)}
      >
        {summary}
      </button>
      {expanded ? (
        <div className={bodyClassName}>
          <CodeBlock lang="javascript">{js}</CodeBlock>
          {part.resultText !== undefined ? (
            <pre className={outputClassName}>{part.resultText}</pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const labelStyle = style(prose("sm").paragraph, {
  color: colors.gray[11],
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const styles = {
  root: style(flex({ direction: "column", gap: 2 }), radius.md, {
    minWidth: 0,
  }),
  rootExpanded: style(spacing.padding({ x: 3, y: 2 }), {
    backgroundColor: colors.gray[3],
  }),
  label: labelStyle,
  summary: style(labelStyle, {
    textAlign: "left",
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    width: "100%",
    font: "inherit",
  }),
  shell: style(monospace),
  body: style(flex({ direction: "column", gap: 3 }), {
    minWidth: 0,
  }),
  output: style(text("xs", 400, "highContrast"), monospace, {
    margin: 0,
    padding: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    color: colors.gray[11],
  }),
};
