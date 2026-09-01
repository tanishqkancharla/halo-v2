import { useEffect, useEffectEvent, useState } from "react";
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
import type { SessionViewPart, ToolPart } from "../agentSession/sessionView.ts";
import { ToolCall } from "./ToolCall.tsx";

type ToolActivityPart = Extract<SessionViewPart, { kind: "toolActivity" }>;

const thinkingSize = "0.6em";
const chevronSize = "0.85em";
const markSlot = "0.85em";
const transitionRemovalDelayMs = motionDurationMs + 16;

export function ToolActivity({ part }: { part: ToolActivityPart }) {
  const [expanded, setExpanded] = useState(false);
  const activityClassName = useStyles(styles.activity);
  const summaryClassName = useStyles(styles.summary);
  const thinkingClassName = useStyles(styles.thinking);
  const interactive =
    part.activeCalls.length > 0 || part.completedCalls.length > 0;
  const visibleCalls = expanded ? part.completedCalls : part.activeCalls;

  return (
    <div className={activityClassName} aria-label="Tool activity">
      {interactive ? (
        <button
          type="button"
          className={summaryClassName}
          aria-expanded={expanded}
          data-active={part.active ? "" : undefined}
          onClick={() => setExpanded(!expanded)}
        >
          {part.active ? (
            <span data-activity-thinking="">
              <Thinking size={thinkingSize} variant="muted" />
            </span>
          ) : undefined}
          <span data-activity-chevron="">
            <Icons.ChevronRightLarge width={chevronSize} height={chevronSize} />
          </span>
          {part.summary}
        </button>
      ) : (
        <div className={thinkingClassName}>
          {part.active ? (
            <span data-activity-thinking="">
              <Thinking size={thinkingSize} variant="muted" />
            </span>
          ) : undefined}
          {part.summary}
        </div>
      )}
      <AnimatedToolCalls calls={visibleCalls} />
    </div>
  );
}

function AnimatedToolCalls({ calls }: { calls: ToolPart[] }) {
  const callIds = JSON.stringify(calls.map((call) => call.id));
  const [previousCallIds, setPreviousCallIds] = useState(callIds);
  const [retainedCalls, setRetainedCalls] = useState(calls);
  const transitionClassName = useStyles(styles.callsTransition);
  const callsClassName = useStyles(styles.calls);
  const callClassName = useStyles(styles.call);
  const callContentClassName = useStyles(styles.callContent);

  if (callIds !== previousCallIds) {
    setPreviousCallIds(callIds);
    setRetainedCalls((currentCalls) => {
      const retainedIds = new Set(currentCalls.map((call) => call.id));
      return [
        ...currentCalls,
        ...calls.filter((call) => !retainedIds.has(call.id)),
      ];
    });
  }

  const finishTransition = useEffectEvent((transitionCallIds: string) => {
    const currentCallIds = JSON.stringify(calls.map((call) => call.id));
    if (currentCallIds !== transitionCallIds) return;
    const visibleIds = new Set(calls.map((call) => call.id));
    setRetainedCalls((currentCalls) =>
      currentCalls.filter((call) => visibleIds.has(call.id)),
    );
  });

  useEffect(() => {
    const timeout = window.setTimeout(
      () => finishTransition(callIds),
      transitionRemovalDelayMs,
    );
    return () => window.clearTimeout(timeout);
  }, [callIds]);

  if (retainedCalls.length === 0) return undefined;

  const visibleCalls = new Map(calls.map((call) => [call.id, call]));
  return (
    <div
      className={transitionClassName}
      data-visible={calls.length > 0 ? "" : undefined}
    >
      <div className={callsClassName}>
        {retainedCalls.map((retainedCall) => {
          const visibleCall = visibleCalls.get(retainedCall.id);
          return (
            <div
              key={retainedCall.id}
              className={callClassName}
              data-visible={visibleCall === undefined ? undefined : ""}
            >
              <div className={callContentClassName}>
                <ToolCall
                  part={visibleCall === undefined ? retainedCall : visibleCall}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const summaryRow = style(
  text({ size: "md", fontWeight: 400, color: "lowContrast" }),
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
  activity: style(flex({ direction: "column" }), {
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
    "&:not([data-active]) [data-activity-chevron]": {
      display: "inline-flex",
    },
    "&[aria-expanded='true']": {
      color: colors.gray[12],
      background: "transparent",
    },
    "&[aria-expanded='true']:not([data-active]) [data-activity-thinking]": {
      display: "none",
    },
    "&[aria-expanded='true']:not([data-active]) [data-activity-chevron]": {
      display: "inline-flex",
    },
    "&[aria-expanded='true'] [data-activity-chevron] svg": {
      transform: "rotate(90deg)",
    },
    "&:focus": {
      outline: "none",
    },
  }),
  callsTransition: style({
    display: "grid",
    gridTemplateRows: "minmax(0, 0fr)",
    minWidth: 0,
    marginTop: 0,
    opacity: 0,
    transition: `grid-template-rows ${String(motionDurationMs)}ms ${motionEasing}, margin-top ${String(motionDurationMs)}ms ${motionEasing}, opacity ${String(motionDurationMs)}ms ${motionEasing}`,
    "&[data-visible]": {
      gridTemplateRows: "minmax(0, 1fr)",
      marginTop: spacing.value(3),
      opacity: 1,
    },
    "@starting-style": {
      gridTemplateRows: "minmax(0, 0fr)",
      marginTop: 0,
      opacity: 0,
    },
  }),
  calls: style(flex({ direction: "column", gap: 2 }), {
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    marginLeft: spacing.value(6),
    paddingLeft: spacing.value(4),
  }),
  call: style({
    display: "grid",
    gridTemplateRows: "minmax(0, 0fr)",
    minWidth: 0,
    opacity: 0,
    transform: `translateY(-${spacing.value(1)})`,
    transition: `grid-template-rows ${String(motionDurationMs)}ms ${motionEasing}, opacity ${String(motionDurationMs)}ms ${motionEasing}, transform ${String(motionDurationMs)}ms ${motionEasing}`,
    "&[data-visible]": {
      gridTemplateRows: "minmax(0, 1fr)",
      opacity: 1,
      transform: "translateY(0)",
    },
    "@starting-style": {
      gridTemplateRows: "minmax(0, 0fr)",
      opacity: 0,
      transform: `translateY(-${spacing.value(1)})`,
    },
  }),
  callContent: style({
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  }),
};
