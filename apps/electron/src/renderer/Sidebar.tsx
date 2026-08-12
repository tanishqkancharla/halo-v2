import {
  Button,
  Icons,
  colors,
  flex,
  flexItem,
  icon,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { AppInfo, SessionSummary } from "../shared/rpc.ts";
import type { SessionSelection } from "./App.tsx";
import { HaloLogo } from "./HaloLogo.tsx";
import { WorkspaceFilesystem } from "./patterns/WorkspaceFilesystem.tsx";
import { sidebarEntry, sidebarEntryLabel } from "./sidebarEntry.ts";

type SidebarProps = {
  sessions: SessionSummary[];
  selection?: SessionSelection;
  onSelectionChange: (selection: SessionSelection) => void;
  onToggleTheme: () => void;
  themeLabel: string;
  appInfo?: AppInfo;
};

export function Sidebar({
  sessions,
  selection,
  onSelectionChange,
  onToggleTheme,
  themeLabel,
  appInfo,
}: SidebarProps) {
  const sidebar = useStyles(styles.sidebar);
  const header = useStyles(styles.header);
  const logo = useStyles(styles.logo);
  const newButton = useStyles(styles.newButton);
  const newIcon = useStyles(icon("sm"));
  const entry = useStyles(sidebarEntry);
  const entryLabel = useStyles(sidebarEntryLabel);
  const section = useStyles(styles.section);
  const filesSection = useStyles(styles.filesSection);
  const filesTree = useStyles(styles.filesTree);
  const sectionLabel = useStyles(styles.sectionLabel);
  const sessionList = useStyles(styles.sessionList);
  const footer = useStyles(styles.footer);
  const versionLabel = useStyles(styles.versionLabel);
  const updateLabel = useStyles(styles.updateLabel);

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
        <Icons.Plus className={newIcon} aria-hidden="true" />
        New session
      </Button>
      <section className={filesSection} aria-labelledby="files-label">
        <div className={sectionLabel} id="files-label">
          Files
        </div>
        <div className={filesTree}>
          <WorkspaceFilesystem />
        </div>
      </section>
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
                  className={entry}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() =>
                    onSelectionChange({
                      kind: "saved",
                      sessionId: session.sessionId,
                    })
                  }
                >
                  <span className={entryLabel}>
                    {session.title ? session.title : session.sessionId}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={section} aria-labelledby="uikit-label">
        <div className={sectionLabel} id="uikit-label">
          Develop
        </div>
        <ul className={sessionList}>
          <li>
            <button
              className={entry}
              type="button"
              aria-current={selection?.kind === "uikit" ? "page" : undefined}
              onClick={() => onSelectionChange({ kind: "uikit" })}
            >
              <span className={entryLabel}>UI kit</span>
            </button>
          </li>
        </ul>
      </section>
      {appInfo !== undefined && (
        <div className={footer} data-testid="app-update-status">
          <div className={versionLabel}>Halo {appInfo.version}</div>
          <div className={updateLabel}>
            {formatUpdateStatus(appInfo.update)}
          </div>
        </div>
      )}
    </nav>
  );
}

function formatUpdateStatus(update: AppInfo["update"]): string {
  switch (update.state) {
    case "disabled":
      return update.reason;
    case "idle":
      return "Up to date · GitHub Releases";
    case "checking":
      return "Checking for updates…";
    case "available":
      return "Update available — downloading…";
    case "downloaded":
      return `Update ${update.version} ready — restart to apply`;
    case "error":
      return `Update error: ${update.message}`;
  }
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
  }),
  section: style(flex({ direction: "column", gap: 4 }), {
    minWidth: 0,
    marginTop: spacing.value(4),
  }),
  filesSection: style(
    flex({ direction: "column", gap: 4 }),
    flexItem({ size: "auto" }),
    {
      minWidth: 0,
      minHeight: "200px",
      marginTop: spacing.value(4),
    },
  ),
  filesTree: style(flexItem({ size: "auto" }), {
    minWidth: 0,
    minHeight: 0,
    height: "0",
    marginInline: `calc(-1 * ${spacing.value(2)})`,
    width: `calc(100% + ${spacing.value(2)} + ${spacing.value(2)})`,
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
    margin: `0 calc(-1 * ${spacing.value(2)})`,
    width: `calc(100% + ${spacing.value(2)} + ${spacing.value(2)})`,
    gap: "1px",
  }),
  footer: style(
    flex({ direction: "column", gap: 1 }),
    spacing.padding({ x: 4, top: 4, bottom: 8 }),
    flexItem({ size: "hug" }),
    {
      marginTop: "auto",
      minWidth: 0,
    },
  ),
  versionLabel: style(text("xs", 500, "highContrast"), {
    minWidth: 0,
  }),
  updateLabel: style(text("xs", 400, "lowContrast"), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
};
