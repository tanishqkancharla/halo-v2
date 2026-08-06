import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  AssistantMessage,
  Button,
  Editor,
  H1,
  H3,
  Loader,
  P,
  backgroundColor,
  colors,
  flex,
  flexItem,
  radius,
  shadowVars,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  useCreateSessionMutation,
  useIsSendingPrompt,
  useLivePrompt,
  useSendPromptMutation,
  useSessionTranscriptQuery,
  promptFailureMessage,
  type LivePrompt,
} from "./api/ApiProvider.tsx";
import {
  type SessionSummary,
  type SessionTranscript,
} from "./api/SystemApi.ts";
import type { SessionSelection } from "./App.tsx";

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
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const editorArea = useStyles(styles.editorArea);
  const status = useStyles(styles.status);
  const sessionId = selection?.kind === "saved" ? selection.sessionId : null;
  const transcript = useSessionTranscriptQuery(sessionId);
  const livePrompt = useLivePrompt(sessionId);
  const sendPrompt = useSendPromptMutation();
  const isSending = useIsSendingPrompt(sessionId);
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

  const session = sessions.find(
    ({ sessionId: candidate }) => candidate === selection.sessionId,
  );
  const title = session?.title ? session.title : selection.sessionId;
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
        <div className={editorArea}>
          <PromptEditor
            key={selection.sessionId}
            isSending={isSending}
            onSubmit={(prompt) =>
              sendPrompt.mutateAsync({
                sessionId: selection.sessionId,
                text: prompt,
              })
            }
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
  const [durableSessionId, setDurableSessionId] = useState<string>();
  const createSession = useCreateSessionMutation();
  const sendPrompt = useSendPromptMutation();
  const livePrompt = useLivePrompt(
    durableSessionId === undefined ? null : durableSessionId,
  );
  const pane = useStyles(styles.pane);
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const editorArea = useStyles(styles.editorArea);

  async function submit(prompt: string) {
    let sessionId = durableSessionId;
    if (sessionId === undefined) {
      const session = await createSession.mutateAsync();
      sessionId = session.sessionId;
      setDurableSessionId(sessionId);
    }
    await sendPrompt.mutateAsync({ sessionId, text: prompt });
    onSent(draftId, sessionId);
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
        <div className={editorArea}>
          <PromptEditor
            key={draftId}
            isSending={createSession.isPending ? true : sendPrompt.isPending}
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
  const error = useStyles(styles.promptError);
  const trimmedText = draft.text.trim();
  const sendDisabled = isSending ? true : trimmedText.length === 0;

  async function submit() {
    if (isSending) return;
    if (!trimmedText) return;

    const submittedText = trimmedText;
    setDraft({ text: draft.text });
    try {
      await onSubmit(submittedText);
      setDraft((current) =>
        current.text === draft.text ? { text: "" } : current,
      );
    } catch (submitError) {
      setDraft((current) => ({
        text: current.text,
        error: promptFailureMessage(submitError),
      }));
    }
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
          <Button onClick={submit} disabled={sendDisabled}>
            {isSending ? "Sending…" : "Send"}
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
          {livePrompt.assistantText.length === 0 ? null : (
            <Message
              role="assistant"
              text={livePrompt.assistantText}
              isAnimating={livePrompt.status === "sending"}
            />
          )}
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
  const messageClass = useStyles(
    role === "user" ? styles.userMessage : styles.assistantMessage,
  );
  const body = useStyles(styles.messageBody);
  const thinking = useStyles(styles.thinking);
  const roleLabel = role === "user" ? "You" : "Assistant";

  if (role === "assistant") {
    return (
      <article className={messageClass} aria-label={`${roleLabel} message`}>
        {messageText ? (
          <AssistantMessage size="sm" isAnimating={isAnimating}>
            {messageText}
          </AssistantMessage>
        ) : isAnimating ? (
          <span className={thinking}>
            <Loader size="0.75em" variant="muted" aria-label="Generating" />
            Thinking…
          </span>
        ) : null}
      </article>
    );
  }

  return (
    <article className={messageClass} aria-label={`${roleLabel} message`}>
      <div className={body}>{messageText}</div>
    </article>
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
  editorArea: style(flexItem({ size: "hug" }), {
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
  assistantMessage: style(flexItem({ size: "hug" }), {
    width: "100%",
    minWidth: 0,
  }),
  thinking: style(
    text("xs", 400, "lowContrast"),
    flex({ align: "center", gap: 2 }),
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
    "&&": { boxShadow: shadowVars.medium },
    backgroundColor: `light-dark(transparent, ${colors.gray[2]})`,
  }),
  promptError: style(
    text("xs", 500, "highContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      color: "light-dark(#b42318, #ff9592)",
    },
  ),
};
