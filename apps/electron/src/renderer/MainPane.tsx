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
  prose,
  radius,
  shadow,
  shadowVars,
  spacing,
  text,
} from "maui";
import { AssistantMessage } from "maui/src/patterns/AssistantMessage.tsx";
import { Editor } from "maui/src/patterns/Editor.tsx";
import { Loader } from "maui/src/patterns/Loader.tsx";
import { style, useStyles } from "purse-styles";
import {
  useDraftAgentSession,
  useIsSendingPrompt,
  useLivePrompt,
  useOpenAgentSession,
  useSendPromptMutation,
  useSessionTranscriptQuery,
  type LivePrompt,
} from "./api/ApiProvider.tsx";
import { type SessionSummary, type SessionTranscript } from "../shared/rpc.ts";
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
  const status = useStyles(styles.status);
  const pane = useStyles(styles.pane);
  const transcript = useSessionTranscriptQuery(sessionId);
  const livePrompt = useLivePrompt(sessionId);
  const agentSession = useOpenAgentSession(sessionId);
  const sendPrompt = useSendPromptMutation();
  const isSending = useIsSendingPrompt(sessionId);
  const session = sessions.find(
    ({ sessionId: candidate }) => candidate === sessionId,
  );
  const title = session?.title ? session.title : sessionId;

  return (
    <main className={pane} aria-label={title}>
      <div className={content}>
        <header className={header}>
          <H3>{title}</H3>
        </header>
        {transcript.isPending ? (
          <div className={status} aria-live="polite">
            Loading transcript…
          </div>
        ) : transcript.isError ? (
          <div className={status} role="alert">
            Could not load transcript: {String(transcript.error)}
          </div>
        ) : transcript.data.messages.length === 0 &&
          livePrompt === undefined ? (
          <div className={status}>No messages yet.</div>
        ) : (
          <MessageFeed transcript={transcript.data} livePrompt={livePrompt} />
        )}
        <div className={composer}>
          <PromptEditor
            key={sessionId}
            isSending={isSending ? true : agentSession === null}
            onSubmit={async (prompt) => {
              if (agentSession === null) {
                return new PromptSubmitError({
                  reason: "Session is not ready.",
                });
              }
              return sendPrompt.mutateAsync({
                session: agentSession,
                sessionId,
                text: prompt,
              });
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
  const { ensureSession } = useDraftAgentSession();
  const sendPrompt = useSendPromptMutation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const livePrompt = useLivePrompt(sessionId);
  const pane = useStyles(styles.pane);
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const composer = useStyles(styles.composer);

  async function submit(prompt: string) {
    const session = await ensureSession();
    const createdSessionId = await session.getSessionId();
    setSessionId(createdSessionId);
    await sendPrompt.mutateAsync({
      session,
      sessionId: createdSessionId,
      text: prompt,
    });
    onSent(draftId, createdSessionId);
  }

  return (
    <main className={pane} aria-label="New session" data-draft-id={draftId}>
      <div className={content}>
        <header className={header}>
          <H1>New session</H1>
          <P>Send a message to start this session.</P>
        </header>
        {livePrompt === undefined ? null : (
          <MessageFeed transcript={emptyTranscript} livePrompt={livePrompt} />
        )}
        <div className={composer}>
          <PromptEditor
            key={draftId}
            isSending={sendPrompt.isPending}
            onSubmit={submit}
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

    const submittedText = trimmedText;
    setDraft({ text: draft.text });
    const result = await onSubmit(submittedText).catch(
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

function MessageFeed({
  transcript,
  livePrompt,
}: {
  transcript: SessionTranscript;
  livePrompt: LivePrompt | undefined;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const feed = useStyles(styles.feed);
  const liveStatus = useStyles(styles.liveStatus);

  useLayoutEffect(() => {
    const element = feedRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [transcript, livePrompt]);

  return (
    <div
      className={feed}
      role="log"
      aria-label="Session transcript"
      aria-relevant="additions"
      ref={feedRef}
    >
      {transcript.messages.map((message) => (
        <Message key={message.id} role={message.role} text={message.text} />
      ))}
      {livePrompt === undefined ? null : (
        <>
          <Message role="user" text={livePrompt.userText} />
          <Message
            role="assistant"
            text={livePrompt.assistantText}
            isAnimating={livePrompt.status === "sending"}
          />
          {livePrompt.status === "failed" ? (
            <div className={liveStatus} role="alert">
              {livePrompt.error === undefined
                ? "The response stopped before it finished."
                : livePrompt.error}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Message({
  role,
  text: messageText,
  isAnimating = false,
}: {
  role: "user" | "assistant";
  text: string;
  isAnimating?: boolean;
}) {
  const userRow = useStyles(styles.userRow);
  const userBubble = useStyles(styles.userBubble);
  const assistantRow = useStyles(styles.assistantRow);
  const assistantMessage = useStyles(styles.assistantMessage);
  const thinking = useStyles(styles.thinking);

  if (role === "assistant") {
    return (
      <div className={assistantRow} aria-label="Assistant message">
        {messageText ? (
          <AssistantMessage
            size="sm"
            className={assistantMessage}
            isAnimating={isAnimating}
          >
            {messageText}
          </AssistantMessage>
        ) : null}
        {isAnimating ? (
          <span className={thinking}>
            <Loader size="0.75em" variant="muted" aria-label="Thinking" />
            Thinking
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={userRow} aria-label="You message">
      <div className={userBubble}>{messageText}</div>
    </div>
  );
}

const emptyTranscript: SessionTranscript = {
  messages: [],
};

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
  status: style(text("sm", 400, "lowContrast"), {
    margin: 0,
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
  userRow: style(flex({ justify: "end" }), {
    minWidth: 0,
    alignSelf: "stretch",
  }),
  userBubble: style(
    prose("sm").paragraph,
    radius.md,
    shadow.subtle,
    spacing.padding({ x: 4, y: 2 }),
    {
      backgroundColor: backgroundColor.element,
      whiteSpace: "pre-wrap",
      maxWidth: "80%",
    },
  ),
  assistantRow: style(flex({ direction: "column", gap: 3 }), {
    minWidth: 0,
    width: "100%",
    alignSelf: "stretch",
  }),
  assistantMessage: style({
    maxWidth: "none",
    width: "100%",
  }),
  thinking: style(
    text("xs", 400, "lowContrast"),
    flex({ align: "center", gap: 4 }),
  ),
  promptEditor: style(flex({ direction: "column", gap: 2 }), {
    width: "100%",
    minWidth: 0,
  }),
  editorSurface: style({
    maxWidth: "none",
    width: "100%",
    // Keep the editor's subtle elevation on focus; drop the blue focus ring.
    "&:focus-within": {
      outline: "none",
      boxShadow: shadowVars.subtle,
      zIndex: "auto",
    },
  }),
  sendButton: style(radius.circle, {
    boxShadow: "none",
    // Editor shell is also `background.app` white; a light wash keeps the circle
    // readable once the default Button shadow is removed.
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
