import {
  Button,
  Icons,
  backgroundColor,
  colors,
  flex,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import haloLogo from "../src-tauri/icons/32x32.png";
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
  const logo = useStyles(styles.logo);
  const newButton = useStyles(styles.newButton);
  const sessionLink = useStyles(styles.sessionLink);
  const section = useStyles(styles.section);
  const sectionLabel = useStyles(styles.sectionLabel);
  const sessionList = useStyles(styles.sessionList);
  const sessionTitle = useStyles(styles.sessionTitle);
  const sessionState = useStyles(styles.sessionState);

  return (
    <nav className={sidebar} aria-label="Sessions">
      <div className={header}>
        <span className={logo} aria-label="Halo" role="img" />
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
      <section className={section} aria-labelledby="sessions-label">
        <div className={sectionLabel} id="sessions-label">
          Sessions
        </div>
        <ul className={sessionList}>
          {sessions.map((session) => {
            const active =
              selection?.kind === "saved" &&
              selection.sessionId === session.sessionId;
            const state = stateLabel(session.state);

            return (
              <li key={session.sessionId}>
                <button
                  className={sessionLink}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() =>
                    onSelectionChange({
                      kind: "saved",
                      sessionId: session.sessionId,
                    })
                  }
                >
                  <span className={sessionTitle}>
                    {session.title ? session.title : session.sessionId}
                  </span>
                  {state ? <span className={sessionState}>{state}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </nav>
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
  sidebar: style(
    shadow.medium,
    spacing.padding({ x: 2, bottom: 2 }),
    flex({ direction: "column", gap: 6 }),
    {
      width: "100%",
      minWidth: 0,
      height: "100%",
      minHeight: 0,
      overflowY: "auto",
      position: "relative",
      zIndex: 1,
      backgroundColor: colors.gray[1],
    },
  ),
  header: style(flex({ align: "center", justify: "between" }), {
    minWidth: 0,
    minHeight: "42px",
    paddingLeft: "84px",
  }),
  logo: style({
    display: "block",
    width: "28px",
    height: "28px",
    backgroundImage: `url(${haloLogo})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
  }),
  newButton: style(flex({ align: "center", gap: 3 }), {
    alignSelf: "stretch",
    marginInline: spacing.value(4),
    "& svg": { width: "16px", height: "16px" },
  }),
  sessionLink: style(
    spacing.padding({ x: 4, y: 2 }),
    text("sm", 400, "highContrast"),
    radius.sm,
    flex({ align: "center", gap: 3 }),
    {
      width: "100%",
      minWidth: 0,
      border: 0,
      outline: "none",
      cursor: "default",
      background: "transparent",
      textAlign: "left",
      "& svg": { width: "16px", height: "16px", flexShrink: 0 },
      "&:hover": { background: backgroundColor.elementHover },
      "&[aria-current='page']": {
        color: colors.accent[9],
        fontWeight: 500,
      },
    },
  ),
  section: style(flex({ direction: "column", gap: 4 }), {
    minWidth: 0,
  }),
  sectionLabel: style(
    text("xs", 500, "lowContrast"),
    spacing.padding({ x: 4 }),
    {
      letterSpacing: "0.02em",
    },
  ),
  sessionList: style(flex({ direction: "column" }), {
    listStyleType: "none",
    padding: 0,
    margin: 0,
    gap: "1px",
  }),
  sessionTitle: style({
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  sessionState: style(text("xs", 400, "lowContrast"), {
    marginLeft: "auto",
    flexShrink: 0,
  }),
};
