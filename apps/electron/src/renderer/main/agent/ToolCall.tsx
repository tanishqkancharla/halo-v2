import { useId, useState } from "react";
import {
  CodeBlock,
  colors,
  flex,
  monospace,
  prose,
  radius,
  spacing,
} from "maui";
import { style, useStyles } from "purse-styles";
import { execJsSource, toolPartLabel, type ToolPart } from "./sessionView.ts";
import { useWorkspaceQuery } from "../../api/ApiProvider.tsx";

export function ToolCall({ part }: { part: ToolPart }) {
  const workspace = useWorkspaceQuery().data;
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;
  const label = toolPartLabel(part, workspaceRoot);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const rootClassName = useStyles(
    styles.root,
    expanded ? styles.rootExpanded : undefined,
  );
  const summaryClassName = useStyles(styles.summary);
  const shellClassName = useStyles(styles.shell);
  const bodyClassName = useStyles(styles.body);
  const { details } = part;
  const js = details.toolPath === "exec" ? execJsSource(details) : undefined;
  const input =
    js === undefined ? JSON.stringify(details.args, undefined, 2) : js;

  const summary =
    label.kind === "shell" ? (
      <>
        {"$ "}
        <span className={shellClassName}>{label.text}</span>
      </>
    ) : (
      <>{label.text}</>
    );

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className={summaryClassName}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${label.text} (${part.tool.path})`}
        onClick={() => setExpanded(!expanded)}
      >
        {summary}
      </button>
      {expanded ? (
        <div
          id={detailsId}
          className={bodyClassName}
          role="region"
          aria-label={part.tool.path}
        >
          {input !== undefined ? (
            <CodeBlock lang={js === undefined ? "json" : "javascript"}>
              {input}
            </CodeBlock>
          ) : undefined}
          {details.resultText !== undefined ? (
            <CodeBlock lang="text">{details.resultText}</CodeBlock>
          ) : undefined}
        </div>
      ) : undefined}
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
  shell: style(monospace, { fontFeatureSettings: '"calt" 1' }),
  body: style(flex({ direction: "column", gap: 3 }), {
    minWidth: 0,
    "& pre, & code": {
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    },
  }),
};
