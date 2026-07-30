import { useLayoutEffect, useRef } from "react";
import {
  H1,
  P,
  backgroundColor,
  colors,
  flex,
  flexItem,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { useSessionTranscriptQuery } from "./api/ApiProvider.tsx";
import {
  type SessionMessage,
  type SessionSummary,
  type SessionTranscript,
} from "./api/SystemApi.ts";
import type { SessionSelection } from "./App.tsx";

export function MainPane({
  selection,
  sessions,
}: {
  selection?: SessionSelection;
  sessions: SessionSummary[];
}) {
  const pane = useStyles(styles.pane);
  const header = useStyles(styles.header);
  const status = useStyles(styles.status);
  const sessionId = selection?.kind === "saved" ? selection.sessionId : null;
  const transcript = useSessionTranscriptQuery(sessionId);
  if (!selection) {
    return (
      <main className={pane} aria-label="Session">
        <P>Loading sessions…</P>
      </main>
    );
  }

  if (selection.kind === "draft") {
    return (
      <main
        className={pane}
        aria-label="New session"
        data-draft-id={selection.draftId}
      >
        <header className={header}>
          <H1>New session</H1>
          <P>Send a message to start this session.</P>
        </header>
      </main>
    );
  }

  const session = sessions.find(
    ({ sessionId: candidate }) => candidate === selection.sessionId,
  );
  const title = session?.title ? session.title : selection.sessionId;
  return (
    <main className={pane} aria-label={title}>
      <header className={header}>
        <H1>{title}</H1>
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
    </main>
  );
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
  const article = useStyles(styles.message);
  const messageHeader = useStyles(styles.messageHeader);
  const role = useStyles(styles.role);
  const timestamp = useStyles(styles.timestamp);
  const body = useStyles(styles.messageBody);
  const roleLabel = message.role === "user" ? "You" : "Assistant";

  return (
    <article className={article} aria-label={`${roleLabel} message`}>
      <header className={messageHeader}>
        <span className={role}>{roleLabel}</span>
        <time className={timestamp} dateTime={message.timestamp}>
          {formatTimestamp(message.timestamp)}
        </time>
      </header>
      <div className={body}>{message.text}</div>
    </article>
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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const styles = {
  pane: style(
    flex({ direction: "column", gap: 6 }),
    spacing.padding({ x: 12, y: 12 }),
    {
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
  message: style(
    flexItem({ size: "hug" }),
    radius.lg,
    shadow.subtle,
    spacing.padding({ all: 8 }),
    {
      width: "min(100%, 760px)",
      minWidth: 0,
      backgroundColor: colors.gray[2],
    },
  ),
  messageHeader: style(flex({ align: "center", gap: 2, wrap: true }), {
    marginBottom: spacing.value(4),
  }),
  role: style(text("sm", 500, "highContrast")),
  timestamp: style(text("xs", 400, "lowContrast")),
  messageBody: style(text("sm", 400, "highContrast"), {
    minWidth: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  }),
};
