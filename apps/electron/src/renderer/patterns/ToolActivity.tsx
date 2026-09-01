import { useState } from "react";
import {
  Icons,
  Thinking,
  colors,
  flex,
  motionDurationMs,
  motionEasing,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { SessionViewPart } from "../agentSession/sessionView.ts";
import { ToolCall } from "./ToolCall.tsx";

type ToolActivityPart = Extract<SessionViewPart, { kind: "toolActivity" }>;

const thinkingSize = "0.6em";
const chevronSize = "0.85em";
const markSlot = "0.85em";

export function ToolActivity({ part }: { part: ToolActivityPart }) {
  const [expanded, setExpanded] = useState(false);
  const activityClassName = useStyles(styles.activity);
  const summaryClassName = useStyles(styles.summary);
  const thinkingClassName = useStyles(styles.thinking);
  const callsClassName = useStyles(styles.calls);
  const interactive =
    part.activeCalls.length > 0 || part.completedCalls.length > 0;
  const visibleCalls = (() => {
    if (part.toolsDone === true) {
      return expanded ? part.completedCalls : [];
    }
    if (expanded) return part.completedCalls;
    return part.activeCalls;
  })();

  return (
    <div className={activityClassName} aria-label="Tool activity">
      {interactive ? (
        <button
          type="button"
          className={summaryClassName}
          aria-expanded={expanded}
          data-tools-done={part.toolsDone === true ? "" : undefined}
          onClick={() => setExpanded(!expanded)}
        >
          {part.toolsDone === true ? undefined : (
            <span data-activity-thinking="">
              <Thinking size={thinkingSize} variant="muted" />
            </span>
          )}
          <span data-activity-chevron="">
            <Icons.ChevronRightLarge width={chevronSize} height={chevronSize} />
          </span>
          {part.summary}
        </button>
      ) : (
        <div className={thinkingClassName}>
          {part.toolsDone === true ? undefined : (
            <span data-activity-thinking="">
              <Thinking size={thinkingSize} variant="muted" />
            </span>
          )}
          {part.summary}
        </div>
      )}
      {visibleCalls.length > 0 ? (
        <div className={callsClassName}>
          {visibleCalls.map((call) => (
            <ToolCall key={call.id} part={call} />
          ))}
        </div>
      ) : undefined}
    </div>
  );
}

const summaryRow = style(
  text("md", 400, "lowContrast"),
  flex({ align: "center", gap: 4 }),
  {
    overflow: "visible",
    color: colors.gray[11],
    "& [data-activity-thinking], & [data-activity-chevron]": {
      display: "inline-flex",
      width: markSlot,
      height: markSlot,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
  },
);

const styles = {
  activity: style(flex({ direction: "column", gap: 3 }), {
    minWidth: 0,
  }),
  thinking: summaryRow,
  summary: style(summaryRow, {
    width: "fit-content",
    maxWidth: "100%",
    minWidth: 0,
    padding: 0,
    border: "none",
    margin: 0,
    appearance: "none",
    background: "transparent",
    justifyContent: "flex-start",
    textAlign: "left",
    cursor: "pointer",
    "& > span": { flexShrink: 0 },
    "& [data-activity-chevron]": { display: "none" },
    "& [data-activity-chevron] svg": {
      transition: `transform ${String(motionDurationMs)}ms ${motionEasing}`,
      transformOrigin: "center",
    },
    "&:hover, &:focus-visible": {
      color: colors.gray[12],
      background: "transparent",
    },
    "&:hover [data-activity-thinking], &:focus-visible [data-activity-thinking]":
      {
        display: "none",
      },
    "&:hover [data-activity-chevron], &:focus-visible [data-activity-chevron]":
      {
        display: "inline-flex",
      },
    "&[data-tools-done] [data-activity-chevron]": {
      display: "inline-flex",
    },
    "&[aria-expanded='true']": {
      color: colors.gray[12],
      background: "transparent",
    },
    "&[aria-expanded='true'] [data-activity-thinking]": {
      display: "none",
    },
    "&[aria-expanded='true'] [data-activity-chevron]": {
      display: "inline-flex",
    },
    "&[aria-expanded='true'] [data-activity-chevron] svg": {
      transform: "rotate(90deg)",
    },
    "&:focus": {
      outline: "none",
    },
  }),
  calls: style(flex({ direction: "column", gap: 2 }), {
    minWidth: 0,
    marginLeft: spacing.value(6),
    paddingLeft: spacing.value(4),
  }),
};
