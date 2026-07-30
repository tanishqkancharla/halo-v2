import {
  Button,
  Icons,
  Sidebar as MauiSidebar,
  SidebarItem,
  SidebarSection,
  flex,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { SessionSelection } from "./App.tsx";
import type { SessionState, SessionSummary } from "./api/SystemApi.ts";

type SidebarProps = {
  sessions: SessionSummary[];
  selection?: SessionSelection;
  onSelectionChange: (selection: SessionSelection) => void;
  onToggleTheme: () => void;
  themeLabel: string;
};

export function Sidebar({
  sessions,
  selection,
  onSelectionChange,
  onToggleTheme,
  themeLabel,
}: SidebarProps) {
  const sidebar = useStyles(styles.sidebar);
  const header = useStyles(styles.header);
  const brand = useStyles(styles.brand);
  const newButton = useStyles(styles.newButton);

  return (
    <MauiSidebar className={sidebar} aria-label="Sessions">
      <div className={header}>
        <span className={brand}>Halo</span>
        <Button variant="quiet" onClick={onToggleTheme}>
          {themeLabel}
        </Button>
      </div>
      <Button
        className={newButton}
        onClick={() =>
          onSelectionChange({ kind: "draft", draftId: crypto.randomUUID() })
        }
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
            {session.title ? session.title : session.sessionId}
          </SidebarItem>
        ))}
      </SidebarSection>
    </MauiSidebar>
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

const styles = {
  sidebar: style({
    width: "100%",
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    borderRadius: 0,
  }),
  header: style(flex({ align: "center", justify: "between" }), {
    minWidth: 0,
  }),
  brand: style(text("sm", 600, "highContrast")),
  newButton: style(flex({ align: "center", gap: 3 }), {
    width: "100%",
    "& svg": { width: "16px", height: "16px" },
  }),
};
