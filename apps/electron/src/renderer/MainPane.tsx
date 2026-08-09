import * as errore from "errore";
import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  Button,
  H1,
  H3,
  Icons,
  P,
  backgroundColor,
  colors,
  flex,
  flexItem,
  icon,
  monospace,
  prose,
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
  sessionFeedItems,
  toolPartLabel,
  type SessionFeedItem,
} from "./agentSession/sessionFeed.ts";
import type { AgentSessionState } from "../shared/AgentSessionState.ts";
import { AssistantMessage } from "./patterns/AssistantMessage.tsx";
import { Editor } from "./patterns/Editor.tsx";
import { Loader } from "./patterns/Loader.tsx";
import { type SessionSummary } from "../shared/rpc.ts";
import type { SessionSelection } from "./App.tsx";

class PromptSubmitError extends errore.createTaggedError({
  name: "PromptSubmitError",
  message: "Failed to send prompt: $reason",
}) {}

export function MainPane({
  selection,
  sessions,
  onDraftSent,
}: {
  selection?: SessionSelection;
  sessions: SessionSummary[];
  onDraftSent: (draftId: string, sessionId: string) => void;
}) {
  const pane = useStyles(styles.pane);
  if (!selection) {
    return (
      <main className={pane} aria-label="Session">
        <P>Loading sessions…</P>
      </main>
    );
  }

  if (selection.kind === "draft") {
    return <DraftPane draftId={selection.draftId} onSent={onDraftSent} />;
  }

  return <SavedPane sessionId={selection.sessionId} sessions={sessions} />;
}

function SavedPane({
  sessionId,
  sessions,
}: {
  sessionId: string;
  sessions: SessionSummary[];
}) {
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const composer = useStyles(styles.composer);
  const pane = useStyles(styles.pane);
  const { session, state, isWorking, prompt } = useAgentSession(sessionId);
  const sessionMeta = sessions.find(
    ({ sessionId: candidate }) => candidate === sessionId,
  );
  const title = sessionMeta?.title ? sessionMeta.title : sessionId;

  return (
    <main className={pane} aria-label={title}>
      <div className={content}>
        <header className={header}>
          <H3>{title}</H3>
        </header>
        <SessionFeed state={state} isWorking={isWorking} />
        <div className={composer}>
          <PromptEditor
            key={sessionId}
            isSending={isWorking ? true : session === null}
            onSubmit={async (promptText) => {
              const result = await prompt(promptText);
              if (result instanceof Error) {
                return new PromptSubmitError({ reason: result.message });
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}

function DraftPane({
  draftId,
  onSent,
}: {
  draftId: string;
  onSent: (draftId: string, sessionId: string) => void;
}) {
  const { state, isWorking, prompt } = useDraftAgentSession((sessionId) => {
    onSent(draftId, sessionId);
  });
  const pane = useStyles(styles.pane);
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const composer = useStyles(styles.composer);
  const hasMessages = sessionFeedItems(state).length > 0;

  return (
    <main className={pane} aria-label="New session" data-draft-id={draftId}>
      <div className={content}>
        <header className={header}>
          <H1>New session</H1>
          <P>Send a message to start this session.</P>
        </header>
        {hasMessages ? (
          <SessionFeed state={state} isWorking={isWorking} />
        ) : null}
        <div className={composer}>
          <PromptEditor
            key={draftId}
            isSending={isWorking}
            onSubmit={async (promptText) => {
              const result = await prompt(promptText);
              if (result instanceof Error) {
                return new PromptSubmitError({ reason: result.message });
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}

type PromptDraft = { text: string; error?: string };

function PromptEditor({
  isSending,
  onSubmit,
}: {
  isSending: boolean;
  onSubmit: (prompt: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<PromptDraft>({ text: "" });
  const errorId = useId();
  const editor = useStyles(styles.promptEditor);
  const editorSurface = useStyles(styles.editorSurface);
  const sendButton = useStyles(styles.sendButton);
  const sendIcon = useStyles(icon("sm"));
  const error = useStyles(styles.promptError);
  const trimmedText = draft.text.trim();
  const sendDisabled = isSending ? true : trimmedText.length === 0;

  async function submit() {
    if (isSending) return;
    if (!trimmedText) return;

    setDraft({ text: draft.text });
    const result = await onSubmit(trimmedText).catch(
      (e) =>
        new PromptSubmitError({
          reason: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    );
    if (result instanceof Error) {
      setDraft((current) => ({
        text: current.text,
        error: result.message,
      }));
      return;
    }
    setDraft((current) =>
      current.text === draft.text ? { text: "" } : current,
    );
  }

  return (
    <div className={editor}>
      <Editor
        content={draft.text}
        onChange={(markdown) => setDraft({ text: markdown })}
        onSubmit={submit}
        editable={!isSending}
        placeholder="Message Halo"
        aria-label="Message"
        size="sm"
        className={editorSurface}
        actions={
          <Button
            aria-label={isSending ? "Sending" : "Send"}
            className={sendButton}
            disabled={sendDisabled}
            onClick={submit}
          >
            <Icons.ArrowUp className={sendIcon} />
          </Button>
        }
      />
      {draft.error && (
        <div className={error} id={errorId} role="alert">
          {draft.error}
        </div>
      )}
    </div>
  );
}

function SessionFeed({
  state,
  isWorking,
}: {
  state: AgentSessionState;
  isWorking: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const feed = useStyles(styles.feed);
  const liveStatus = useStyles(styles.liveStatus);
  const thinking = useStyles(styles.thinking);
  const items = sessionFeedItems(state);

  useLayoutEffect(() => {
    const element = feedRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [state, isWorking]);

  return (
    <div
      className={feed}
      role="log"
      aria-label="Session transcript"
      aria-relevant="additions"
      ref={feedRef}
    >
      {items.map((item) => (
        <FeedItemView key={item.id} item={item} />
      ))}
      {isWorking ? (
        <span className={thinking}>
          <Loader size="0.75em" variant="muted" aria-label="Thinking" />
          Thinking
        </span>
      ) : null}
      {state.error !== null ? (
        <div className={liveStatus} role="alert">
          {state.error}
        </div>
      ) : null}
    </div>
  );
}

function FeedItemView({ item }: { item: SessionFeedItem }) {
  const userMessage = useStyles(styles.userMessage);
  const body = useStyles(styles.messageBody);
  const assistantRow = useStyles(styles.assistantRow);
  const assistantMessage = useStyles(styles.assistantMessage);
  const toolCallsClassName = useStyles(styles.toolCalls);
  const toolCallClassName = useStyles(styles.toolCall);
  const toolShellClassName = useStyles(styles.toolShell);

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
          const label = toolPartLabel(part);
          return (
            <div
              key={part.id}
              className={toolCallsClassName}
              aria-label="Tool calls"
            >
              <div className={toolCallClassName}>
                {label.kind === "read" ? (
                  <>Read {label.text}</>
                ) : label.kind === "wrote" ? (
                  <>Wrote {label.text}</>
                ) : label.kind === "shell" ? (
                  <>
                    {"$ "}
                    <span className={toolShellClassName}>{label.text}</span>
                  </>
                ) : (
                  <>{label.text}</>
                )}
              </div>
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
  pane: style(
    flex({ direction: "column" }),
    spacing.padding({ x: 12, y: 12 }),
    {
      width: "100%",
      marginInline: "auto",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
      backgroundColor: backgroundColor.app,
    },
  ),
  content: style(flex({ direction: "column" }), {
    flex: "1 1 auto",
    width: "100%",
    maxWidth: "72ch",
    minWidth: 0,
    minHeight: 0,
    marginInline: "auto",
  }),
  header: style(flexItem({ size: "hug" }), {
    minWidth: 0,
    marginBottom: spacing.value(6),
  }),
  feed: style(
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
      paddingBottom: spacing.value(6),
      "&::-webkit-scrollbar": { display: "none" },
    },
  ),
  composer: style(flexItem({ size: "hug" }), {
    width: "100%",
    minWidth: 0,
    position: "relative",
    zIndex: 1,
    overflow: "visible",
    paddingTop: "2px",
    "&::before": {
      position: "absolute",
      right: 0,
      bottom: "100%",
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
  toolCall: style(prose("sm").paragraph, {
    color: colors.gray[11],
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  toolShell: style(monospace),
  thinking: style(
    text("xs", 400, "lowContrast"),
    flex({ align: "center", gap: 4 }),
  ),
  messageBody: style(text("md", 400, "highContrast"), {
    minWidth: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  }),
  promptEditor: style(flex({ direction: "column", gap: 2 }), {
    width: "100%",
    minWidth: 0,
  }),
  editorSurface: style({
    maxWidth: "none",
    width: "100%",
    "&:focus-within": {
      outline: "none",
      boxShadow: shadowVars.subtle,
      zIndex: "auto",
    },
  }),
  sendButton: style(radius.circle, {
    boxShadow: "none",
    backgroundColor: colors.gray[3],
    "&:hover": {
      backgroundColor: colors.gray[4],
    },
    "&:active": {
      backgroundColor: colors.gray[5],
    },
  }),
  promptError: style(
    text("xs", 500, "highContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      color: "light-dark(#b42318, #ff9592)",
    },
  ),
};
