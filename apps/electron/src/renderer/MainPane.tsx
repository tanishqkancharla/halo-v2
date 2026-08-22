import { PluginRuntimeProvider } from "@halo/plugin-sdk/view";
import type { RpcStub, RpcTarget } from "capnweb";
import { useLayoutEffect, useRef, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import {
  Button,
  Icons,
  backgroundColor,
  colors,
  flex,
  flexItem,
  icon,
  radius,
  shadowVars,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  useAgentSession,
  useDraftAgentSession,
} from "./agentSession/useAgentSession.ts";
import {
  sessionViewItems,
  type SessionViewItem,
} from "./agentSession/sessionView.ts";
import {
  lastAssistantTurnWasAborted,
  type AgentSessionState,
} from "../shared/AgentSessionState.ts";
import { AssistantMessage } from "./patterns/AssistantMessage.tsx";
import { Editor } from "./patterns/Editor.tsx";
import { Loader } from "./patterns/Loader.tsx";
import { ToolCall } from "./patterns/ToolCall.tsx";
import { type SessionSummary } from "../shared/rpc.ts";
import type { LoadedPluginView } from "../shared/plugin.js";
import { ThreadHeader } from "./ThreadHeader.tsx";
import { UiKitPage } from "./UiKitPage.tsx";

export function MainPane({
  sessions,
  pluginViews,
  pluginServers,
}: {
  sessions: SessionSummary[];
  pluginViews: LoadedPluginView[];
  pluginServers: Record<string, RpcStub<RpcTarget>>;
}) {
  return (
    <Switch>
      <Route path="/uikit">
        <UiKitPage />
      </Route>
      <Route path="/draft/:draftId">
        {(params) => <DraftPane draftId={params.draftId} />}
      </Route>
      <Route path="/sessions/:sessionId">
        {(params) => (
          <SavedPane sessionId={params.sessionId} sessions={sessions} />
        )}
      </Route>
      <Route path="/plugins/:pluginId" nest>
        {(params) => {
          const plugin = pluginViews.find(
            (item) => item.id === params.pluginId,
          );
          if (plugin === undefined || plugin.Routes === undefined) {
            return <MissingPlugin pluginId={params.pluginId} />;
          }
          return (
            <PluginRuntimeProvider
              pluginId={plugin.id}
              server={pluginServers[plugin.id]}
            >
              <plugin.Routes />
            </PluginRuntimeProvider>
          );
        }}
      </Route>
    </Switch>
  );
}

function MissingPlugin({ pluginId }: { pluginId: string }) {
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.body, styles.bodyTop);
  const column = useStyles(styles.column);
  return (
    <main className={pane} aria-label={pluginId}>
      <div className={body}>
        <div className={column}>Plugin '{pluginId}' has no Routes</div>
      </div>
    </main>
  );
}

function SavedPane({
  sessionId,
  sessions,
}: {
  sessionId: string;
  sessions: SessionSummary[];
}) {
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.body);
  const column = useStyles(styles.column);
  const { state, isWorking, prompt, abort } = useAgentSession(sessionId);
  const sessionMeta = sessions.find(
    ({ sessionId: candidate }) => candidate === sessionId,
  );
  const title = sessionMeta?.title ? sessionMeta.title : sessionId;

  return (
    <main className={pane} aria-label={title}>
      <ThreadHeader title={title} />
      <div className={body}>
        <div className={column}>
          <SessionView state={state} isWorking={isWorking} />
          <Composer
            key={sessionId}
            error={state.error}
            isWorking={isWorking}
            onSubmit={prompt}
            onStop={abort}
          />
        </div>
      </div>
    </main>
  );
}

function DraftPane({ draftId }: { draftId: string }) {
  const [, navigate] = useLocation();
  const { state, isWorking, prompt, abort } = useDraftAgentSession(
    (sessionId) => {
      navigate(`/sessions/${sessionId}`);
    },
  );
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.body, styles.bodyTop);
  const column = useStyles(styles.column);
  const hasMessages = sessionViewItems(state).length > 0;

  return (
    <main className={pane} aria-label="New session" data-draft-id={draftId}>
      <ThreadHeader />
      <div className={body}>
        <div className={column}>
          {hasMessages ? (
            <SessionView state={state} isWorking={isWorking} />
          ) : undefined}
          <Composer
            key={draftId}
            error={state.error}
            isWorking={isWorking}
            onSubmit={prompt}
            onStop={abort}
          />
        </div>
      </div>
    </main>
  );
}

function Composer({
  error,
  isWorking,
  onSubmit,
  onStop,
}: {
  error: string | undefined;
  isWorking: boolean;
  onSubmit: (prompt: string) => Promise<void | Error>;
  onStop: () => Promise<void | Error>;
}) {
  const [draft, setDraft] = useState("");
  const composer = useStyles(styles.composer);
  const liveStatus = useStyles(styles.liveStatus);
  const sendButton = useStyles(styles.sendButton);
  const sendIcon = useStyles(icon("sm"));
  const trimmedText = draft.trim();
  const showStop = isWorking && trimmedText.length === 0;

  async function submit() {
    if (!trimmedText) return;

    setDraft("");
    const result = await onSubmit(trimmedText);
    if (result instanceof Error) {
      setDraft(trimmedText);
    }
  }

  return (
    <Editor
      content={draft}
      onChange={setDraft}
      onSubmit={submit}
      placeholder="Message Halo"
      aria-label="Message"
      size="sm"
      className={composer}
      error={
        error === undefined ? undefined : (
          <div className={liveStatus} role="alert">
            {error}
          </div>
        )
      }
      actions={
        <Button
          aria-label={showStop ? "Stop" : "Send"}
          className={sendButton}
          disabled={!showStop && trimmedText.length === 0}
          onClick={showStop ? onStop : submit}
        >
          {showStop ? (
            <StopIcon className={sendIcon} />
          ) : (
            <Icons.ArrowUp className={sendIcon} aria-hidden="true" />
          )}
        </Button>
      }
    />
  );
}

function StopIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      focusable="false"
      aria-hidden="true"
      role="img"
      width={24}
      height={24}
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        width="12.5"
        height="12.5"
        x="5.75"
        y="5.75"
        rx="1"
        fill="currentColor"
      />
    </svg>
  );
}

function SessionView({
  state,
  isWorking,
}: {
  state: AgentSessionState;
  isWorking: boolean;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const view = useStyles(styles.view);
  const thinking = useStyles(styles.thinking);
  const stopped = useStyles(styles.stopped);
  const items = sessionViewItems(state);
  const showStopped =
    !isWorking && lastAssistantTurnWasAborted(state.messages);

  useLayoutEffect(() => {
    const element = viewRef.current;
    if (element === null) return;
    element.scrollTop = element.scrollHeight;
  });

  return (
    <div
      className={view}
      role="log"
      aria-label="Session transcript"
      aria-relevant="additions"
      ref={viewRef}
    >
      {items.map((item) => (
        <SessionViewRow key={item.id} item={item} />
      ))}
      {isWorking ? (
        <span className={thinking}>
          <Loader size="0.75em" variant="muted" aria-label="Thinking" />
          Thinking
        </span>
      ) : undefined}
      {showStopped ? (
        <span className={stopped} role="status">
          Stopped
        </span>
      ) : undefined}
    </div>
  );
}

function SessionViewRow({ item }: { item: SessionViewItem }) {
  const userMessage = useStyles(styles.userMessage);
  const body = useStyles(styles.messageBody);
  const assistantRow = useStyles(styles.assistantRow);
  const assistantMessage = useStyles(styles.assistantMessage);
  const toolCallsClassName = useStyles(styles.toolCalls);

  if (item.kind === "user") {
    return (
      <article className={userMessage} aria-label="You message">
        <div className={body}>{item.text}</div>
      </article>
    );
  }

  return (
    <div className={assistantRow} aria-label="Assistant message">
      {item.parts.map((part) => {
        if (part.kind === "tool") {
          return (
            <div
              key={part.id}
              className={toolCallsClassName}
              aria-label="Tool calls"
            >
              <ToolCall part={part} />
            </div>
          );
        }
        return (
          <AssistantMessage
            key={part.id}
            size="sm"
            className={assistantMessage}
            isAnimating={part.streaming}
          >
            {part.text}
          </AssistantMessage>
        );
      })}
    </div>
  );
}

const styles = {
  pane: style(flex({ direction: "column" }), {
    width: "100%",
    marginInline: "auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  body: style(
    flex({ direction: "column" }),
    spacing.padding({ x: 12, bottom: 12 }),
    {
      flex: "1 1 auto",
      width: "100%",
      minWidth: 0,
      minHeight: 0,
    },
  ),
  bodyTop: style(spacing.padding({ top: 12 })),
  column: style(flex({ direction: "column" }), {
    flex: "1 1 auto",
    width: "100%",
    maxWidth: "72ch",
    minWidth: 0,
    minHeight: 0,
    marginInline: "auto",
  }),
  view: style(
    flex({ direction: "column", gap: 6 }),
    flexItem({
      size: "auto",
    }),
    {
      minWidth: 0,
      minHeight: 0,
      overflowY: "auto",
      overscrollBehavior: "contain",
      scrollbarWidth: "none",
      // overflow-y: auto clips child box-shadows; padding keeps the 1px ring inside the scrollport.
      paddingInline: spacing.value(2),
      paddingTop: spacing.value(12),
      paddingBottom: spacing.value(6),
      "&::-webkit-scrollbar": { display: "none" },
    },
  ),
  composer: style(flexItem({ size: "hug" }), {
    width: "100%",
    maxWidth: "none",
    minWidth: 0,
    position: "relative",
    zIndex: 1,
    overflow: "visible",
    marginTop: spacing.value(2),
    "&:focus-within": {
      outline: "none",
      boxShadow: shadowVars.subtle,
      zIndex: "auto",
    },
    "&::before": {
      position: "absolute",
      right: 0,
      bottom: "calc(100% + 1px)",
      left: 0,
      height: spacing.value(6),
      content: "''",
      pointerEvents: "none",
      background: `linear-gradient(to bottom, transparent, ${backgroundColor.app})`,
    },
  }),
  liveStatus: style(
    flexItem({ size: "hug" }),
    text("xs", 500, "highContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      color: "light-dark(#b42318, #ff9592)",
      backgroundColor: "light-dark(#ffebe9, #3b1219)",
      borderRadius: "8px",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    },
  ),
  userMessage: style(radius.lg, spacing.padding({ x: 4, y: 2 }), {
    alignSelf: "flex-end",
    width: "fit-content",
    maxWidth: "80%",
    minWidth: 0,
    backgroundColor: colors.gray[3],
  }),
  assistantRow: style(flex({ direction: "column", gap: 3 }), {
    minWidth: 0,
    width: "100%",
    alignSelf: "stretch",
  }),
  assistantMessage: style({
    maxWidth: "none",
    width: "100%",
  }),
  toolCalls: style(flex({ direction: "column", gap: 2 }), {
    minWidth: 0,
  }),
  thinking: style(
    text("xs", 400, "lowContrast"),
    flex({ align: "center", gap: 4 }),
  ),
  stopped: style(text("xs", 400, "lowContrast"), {
    alignSelf: "flex-end",
  }),
  messageBody: style(text("md", 400, "highContrast"), {
    minWidth: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  }),
  sendButton: style(radius.circle, {
    boxShadow: "none",
    backgroundColor: colors.grayAlpha[4],
    "&:hover": {
      backgroundColor: colors.grayAlpha[5],
    },
    "&:active": {
      backgroundColor: colors.grayAlpha[6],
    },
  }),
};
