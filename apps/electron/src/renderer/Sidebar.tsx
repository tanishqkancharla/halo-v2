import {
  Button,
  Icons,
  borderColor,
  colors,
  flex,
  flexItem,
  icon,
  motionDurationMs,
  motionEasing,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { AppInfo, SessionSummary } from "../shared/rpc.ts";
import type { SessionSelection } from "./App.tsx";
import type { LoadedExtension } from "../shared/evaluateExtensionSource.ts";
import type { ExtensionLoadError } from "../shared/extension.ts";
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
  extensionSections: LoadedExtension[];
  extensionErrors: ExtensionLoadError[];
};

export function Sidebar({
  sessions,
  selection,
  onSelectionChange,
  onToggleTheme,
  themeLabel,
  appInfo,
  extensionSections,
  extensionErrors,
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
          <WorkspaceFilesystem maxHeight={filesTreeMaxHeightPx} />
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
      {extensionSections.map((extension) => (
        <ExtensionSidebarSection
          key={extension.id}
          extension={extension}
          selection={selection}
          onSelectionChange={onSelectionChange}
          entry={entry}
          entryLabel={entryLabel}
          section={section}
          sectionLabel={sectionLabel}
          sessionList={sessionList}
        />
      ))}
      {extensionErrors.length > 0 && (
        <section className={section} aria-labelledby="extension-errors-label">
          <div className={sectionLabel} id="extension-errors-label">
            Extensions
          </div>
          <ul className={sessionList}>
            {extensionErrors.map((error) => (
              <li key={error.id}>
                <div
                  className={entry}
                  data-testid="extension-error"
                  role="alert"
                >
                  <span className={entryLabel}>
                    {error.id}: {error.message}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
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

function ExtensionSidebarSection({
  extension,
  selection,
  onSelectionChange,
  entry,
  entryLabel,
  section,
  sectionLabel,
  sessionList,
}: {
  extension: LoadedExtension;
  selection?: SessionSelection;
  onSelectionChange: (selection: SessionSelection) => void;
  entry: string;
  entryLabel: string;
  section: string;
  sectionLabel: string;
  sessionList: string;
}) {
  return (
    <>
      {extension.sidebarEntries.map((sidebarSection) => (
        <section
          key={sidebarSection.id}
          className={section}
          aria-labelledby={`${extension.id}-${sidebarSection.id}-label`}
        >
          <div
            className={sectionLabel}
            id={`${extension.id}-${sidebarSection.id}-label`}
          >
            {sidebarSection.label}
          </div>
          <ul className={sessionList}>
            {sidebarSection.items.map((item) => {
              const active =
                selection?.kind === "extension" &&
                selection.extensionId === extension.id &&
                selection.viewId === item.viewId;

              return (
                <li key={item.id}>
                  <button
                    className={entry}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() =>
                      onSelectionChange({
                        kind: "extension",
                        extensionId: extension.id,
                        viewId: item.viewId,
                      })
                    }
                  >
                    <span className={entryLabel}>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
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

const filesSectionMaxHeightPx = 240;
const filesLabelLineHeightPx = 18;
const filesTreeMaxHeightPx =
  filesSectionMaxHeightPx -
  filesLabelLineHeightPx -
  Number.parseInt(spacing.value(4), 10);

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
    flexItem({ size: "hug" }),
    {
      minWidth: 0,
      minHeight: 0,
      maxHeight: `${filesSectionMaxHeightPx}px`,
      overflow: "hidden",
      marginTop: spacing.value(8),
      position: "relative",
      "&::before, &::after": {
        content: "''",
        position: "absolute",
        right: 0,
        left: 0,
        height: "1px",
        backgroundColor: borderColor.outline,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 3,
        transition: `opacity ${motionDurationMs}ms ${motionEasing}`,
      },
      "&::before": { top: 0 },
      "&::after": { bottom: 0 },
      "&:hover::before, &:hover::after": { opacity: 1 },
    },
  ),
  filesTree: style(flexItem({ size: "hug" }), {
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
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
