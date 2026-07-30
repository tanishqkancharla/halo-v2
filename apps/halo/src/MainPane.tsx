import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Button,
  H1,
  P,
  backgroundColor,
  colors,
  flex,
  flexItem,
  focusRing,
  radius,
  shadow,
  shadowVars,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  useCreateSessionMutation,
  useIsSendingPrompt,
  useSendPromptMutation,
  useSessionTranscriptQuery,
} from "./api/ApiProvider.tsx";
import {
  type SessionMessage,
  type SessionSummary,
  type SessionTranscript,
} from "./api/SystemApi.ts";
import type { SessionSelection } from "./App.tsx";
import { H3 } from "maui";

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
  const header = useStyles(styles.header);
  const status = useStyles(styles.status);
  const sessionId = selection?.kind === "saved" ? selection.sessionId : null;
  const transcript = useSessionTranscriptQuery(sessionId);
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
      <div
        style={{
          width: "72ch",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          margin: "auto",
        }}
      >
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
        ) : transcript.data.messages.length === 0 ? (
          <div className={status}>No messages yet.</div>
        ) : (
          <MessageFeed transcript={transcript.data} />
        )}
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
  const pane = useStyles(styles.pane);
  const header = useStyles(styles.header);

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
      <header className={header}>
        <H1>New session</H1>
        <P>Send a message to start this session.</P>
      </header>
      <PromptEditor
        key={draftId}
        autoFocus
        isSending={createSession.isPending ? true : sendPrompt.isPending}
        onSubmit={submit}
      />
    </main>
  );
}

type PromptDraft = { text: string; error?: string };

function PromptEditor({
  autoFocus = false,
  isSending,
  onSubmit,
}: {
  autoFocus?: boolean;
  isSending: boolean;
  onSubmit: (prompt: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<PromptDraft>({ text: "" });
  const errorId = useId();
  const editor = useStyles(styles.promptEditor);
  const textarea = useStyles(styles.textarea);
  const actions = useStyles(styles.promptActions);
  const error = useStyles(styles.promptError);
  const trimmedText = draft.text.trim();
  const sendDisabled = isSending ? true : trimmedText.length === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        error: String(submitError),
      }));
    }
  }

  return (
    <form className={editor} onSubmit={submit}>
      <textarea
        autoFocus={autoFocus}
        className={textarea}
        value={draft.text}
        onChange={(event) => setDraft({ text: event.currentTarget.value })}
        onKeyDown={submitFromKeyboard}
        placeholder="Message Halo"
        aria-label="Message"
        aria-describedby={draft.error ? errorId : undefined}
      />
      {draft.error && (
        <div className={error} id={errorId} role="alert">
          {draft.error}
        </div>
      )}
      <div className={actions}>
        <Button variant="quiet" type="submit" disabled={sendDisabled}>
          {isSending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}

function submitFromKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter") return;
  if (!event.metaKey && !event.ctrlKey) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function MessageFeed({ transcript }: { transcript: SessionTranscript }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const feed = useStyles(styles.feed);
  const partial = useStyles(styles.partial);
  const hasPartialHistory = transcript.hasMoreBefore
    ? true
    : transcript.hasMoreAfter;

  useLayoutEffect(() => {
    const element = feedRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [transcript]);

  return (
    <div
      className={feed}
      role="feed"
      aria-label="Session transcript"
      ref={feedRef}
    >
      {hasPartialHistory && (
        <div className={partial} role="status">
          {partialHistoryText(transcript)}
        </div>
      )}
      {transcript.messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  );
}

function Message({ message }: { message: SessionMessage }) {
  const messageClass = useStyles(
    message.role === "user" ? styles.userMessage : styles.assistantMessage,
  );
  const body = useStyles(styles.messageBody);
  const roleLabel = message.role === "user" ? "You" : "Assistant";

  return (
    <div className={messageClass} aria-label={`${roleLabel} message`}>
      <div className={body}>{message.text}</div>
    </div>
  );
}

function partialHistoryText({
  hasMoreBefore,
  hasMoreAfter,
}: SessionTranscript): string {
  const missing =
    hasMoreBefore && hasMoreAfter
      ? "Earlier and later messages are not shown."
      : hasMoreBefore
        ? "Earlier messages are not shown."
        : "Later messages are not shown.";
  return `This transcript is one 500-event page. ${missing}`;
}

const styles = {
  pane: style(
    flex({ direction: "column", gap: 6 }),
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
  header: style(flexItem({ size: "hug" }), {
    minWidth: 0,
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
    },
  ),
  partial: style(
    flexItem({ size: "hug" }),
    text("xs", 400, "lowContrast"),
    radius.md,
    spacing.padding({ all: 4 }),
    {
      backgroundColor: colors.gray[3],
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
  messageBody: style(text("sm", 400, "highContrast"), {
    minWidth: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  }),
  promptEditor: style(
    flexItem({ size: "hug" }),
    radius.lg,
    shadow.subtle,
    focusRing("&:focus-within", shadowVars.subtle),
    spacing.padding({ all: 2 }),
    {
      width: "min(100%, 760px)",
      minWidth: 0,
      backgroundColor: backgroundColor.element,
    },
  ),
  textarea: style(text("sm", 400, "highContrast"), {
    display: "block",
    width: "100%",
    minHeight: "56px",
    padding: `${spacing.value(2)} ${spacing.value(4)}`,
    resize: "vertical",
    border: 0,
    outline: 0,
    color: "inherit",
    backgroundColor: "transparent",
  }),
  promptActions: style(flex({ justify: "end" }), {
    marginTop: spacing.value(2),
  }),
  promptError: style(
    text("xs", 500, "highContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      color: "light-dark(#b42318, #ff9592)",
    },
  ),
};
