import {
  Button,
  H1,
  Icons,
  P,
  Sidebar,
  SidebarItem,
  SidebarSection,
  backgroundColor,
  colors,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { SessionState, SessionSummary } from "../api.ts";

export type SessionSelection =
  | { kind: "draft"; draftId: string }
  | { kind: "saved"; sessionId: string };

type SessionsAppProps = {
  sessions: SessionSummary[];
  selection?: SessionSelection;
  onSelectionChange: (selection: SessionSelection) => void;
  onToggleTheme: () => void;
  themeLabel: string;
};

function createDraftSelection(): SessionSelection {
  return { kind: "draft", draftId: crypto.randomUUID() };
}

export function SessionsApp({
  sessions,
  selection,
  onSelectionChange,
  onToggleTheme,
  themeLabel,
}: SessionsAppProps) {
  const shell = useStyles(shellClass);

  return (
    <div className={shell} data-testid="sessions-shell">
      <SessionsSidebar
        sessions={sessions}
        selection={selection}
        onSelectionChange={onSelectionChange}
        onToggleTheme={onToggleTheme}
        themeLabel={themeLabel}
      />
      <SessionPane selection={selection} sessions={sessions} />
    </div>
  );
}

export function SessionsSidebar({
  sessions,
  selection,
  onSelectionChange,
  onToggleTheme,
  themeLabel,
}: SessionsAppProps) {
  const sidebar = useStyles(sidebarClass);
  const sidebarHeader = useStyles(sidebarHeaderClass);
  const brand = useStyles(brandClass);
  const newButton = useStyles(newButtonClass);

  return (
    <Sidebar className={sidebar} aria-label="Sessions">
      <div className={sidebarHeader}>
        <span className={brand}>Halo</span>
        <Button variant="quiet" onClick={onToggleTheme}>
          {themeLabel}
        </Button>
      </div>
      <Button
        className={newButton}
        onClick={() => onSelectionChange(createDraftSelection())}
      >
        <Icons.Plus aria-hidden="true" />
        New session
      </Button>
      <SidebarSection label="Sessions">
        {sessions.map((session) => (
          <SidebarItem
            key={session.sessionId}
            active={
              selection?.kind === "saved" &&
              selection.sessionId === session.sessionId
            }
            trailing={stateLabel(session.state)}
            onClick={() =>
              onSelectionChange({
                kind: "saved",
                sessionId: session.sessionId,
              })
            }
          >
            {session.title || session.sessionId}
          </SidebarItem>
        ))}
      </SidebarSection>
    </Sidebar>
  );
}

export function SessionPane({
  selection,
  sessions,
}: {
  selection?: SessionSelection;
  sessions: SessionSummary[];
}) {
  const pane = useStyles(paneClass);

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
        <H1>New session</H1>
        <P>Send a message to start this session.</P>
      </main>
    );
  }

  const session = sessions.find(
    ({ sessionId }) => sessionId === selection.sessionId,
  );
  const title = session?.title || selection.sessionId;
  return (
    <main className={pane} aria-label={title}>
      <H1>{title}</H1>
      <P>Select another session or start a new one from the sidebar.</P>
    </main>
  );
}

function stateLabel(state: SessionState) {
  switch (state) {
    case "idle":
      return undefined;
    case "running":
      return "Running";
    case "waiting":
      return "Waiting";
    case "failed":
      return "Failed";
  }
}

const shellClass = style({
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr)",
  width: "100%",
  height: "100vh",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  backgroundColor: colors.gray[4],
  "@media (max-width: 560px)": {
    gridTemplateColumns: "180px minmax(0, 1fr)",
  },
});

const sidebarClass = style({
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  height: "100%",
  minHeight: 0,
  overflowY: "auto",
  borderRadius: 0,
});

const sidebarHeaderClass = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minWidth: 0,
});

const brandClass = style(text("sm", 600, "highContrast"));

const newButtonClass = style({
  display: "flex",
  width: "100%",
  gap: spacing.value(3),
  "& svg": { width: "16px", height: "16px" },
});

const paneClass = style(spacing.padding({ x: 12, y: 12 }), {
  boxSizing: "border-box",
  minWidth: 0,
  minHeight: 0,
  overflowY: "auto",
  backgroundColor: backgroundColor.app,
});
