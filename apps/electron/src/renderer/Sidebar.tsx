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
import type { SessionSummary } from "../shared/rpc.ts";
import type { SessionSelection } from "./App.tsx";
import { HaloLogo } from "./HaloLogo.tsx";

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

  return (
    <nav className={sidebar} aria-label="Sessions">
      <div className={header}>
        <HaloLogo className={logo} />
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
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </nav>
  );
}

const styles = {
  sidebar: style(
    shadow.medium,
    spacing.padding({ x: 2, bottom: 2 }),
    flex({ direction: "column", gap: 4 }),
    {
      width: "100%",
      minWidth: 0,
      height: "100%",
      minHeight: 0,
      overflowY: "auto",
      position: "relative",
      zIndex: 1,
      backgroundColor: `light-dark(${colors.gray[1]}, ${colors.gray[2]})`,
    },
  ),
  header: style(flex({ align: "center", justify: "between" }), {
    minWidth: 0,
    minHeight: "42px",
    paddingLeft: "67px",
  }),
  logo: style({
    display: "block",
    width: "20px",
    height: "20px",
    transform: "translateX(-1px) translateY(-3px)",
  }),
  newButton: style(flex({ align: "center", gap: 3 }), {
    alignSelf: "stretch",
    width: `calc(100% - ${spacing.value(4)} - ${spacing.value(4)})`,
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
};
