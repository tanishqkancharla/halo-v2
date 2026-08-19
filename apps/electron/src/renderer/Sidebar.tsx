import {
  PluginRuntimeProvider,
  SidebarItem,
  SidebarSection,
} from "@halo/plugin-sdk/view";
import type { RpcStub, RpcTarget } from "capnweb";
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
import { Router, useLocation } from "wouter";
import type { AppInfo, SessionSummary } from "../shared/rpc.ts";
import type { LoadedPluginView, PluginLoadError } from "../shared/plugin.js";
import { HaloLogo } from "./HaloLogo.tsx";
import { WorkspaceFilesystem } from "./patterns/WorkspaceFilesystem.tsx";

type SidebarProps = {
  sessions: SessionSummary[];
  pluginViews: LoadedPluginView[];
  pluginErrors: PluginLoadError[];
  pluginServers: Record<string, RpcStub<RpcTarget>>;
  onToggleTheme: () => void;
  themeLabel: string;
  appInfo?: AppInfo;
};

export function Sidebar({
  sessions,
  pluginViews,
  pluginErrors,
  pluginServers,
  onToggleTheme,
  themeLabel,
  appInfo,
}: SidebarProps) {
  const sidebar = useStyles(styles.sidebar);
  const header = useStyles(styles.header);
  const logo = useStyles(styles.logo);
  const newButton = useStyles(styles.newButton);
  const newIcon = useStyles(icon("sm"));
  const filesSection = useStyles(styles.filesSection);
  const filesTree = useStyles(styles.filesTree);
  const sectionLabel = useStyles(styles.sectionLabel);
  const sessionList = useStyles(styles.sessionList);
  const footer = useStyles(styles.footer);
  const versionLabel = useStyles(styles.versionLabel);
  const updateLabel = useStyles(styles.updateLabel);
  const pluginError = useStyles(styles.pluginError);

  return (
    <nav className={sidebar} aria-label="Sessions">
      <div className={header}>
        <HaloLogo className={logo} />
        <Button variant="quiet" onClick={onToggleTheme}>
          {themeLabel}
        </Button>
      </div>
      <NewSessionButton className={newButton} iconClassName={newIcon} />
      <section className={filesSection} aria-labelledby="files-label">
        <div className={sectionLabel} id="files-label">
          Files
        </div>
        <div className={filesTree}>
          <WorkspaceFilesystem maxHeight={filesTreeMaxHeightPx} />
        </div>
      </section>
      <SidebarSection label="Sessions">
        {sessions.map((session) => (
          <SidebarItem
            key={session.sessionId}
            href={`/sessions/${session.sessionId}`}
          >
            {session.title ? session.title : session.sessionId}
          </SidebarItem>
        ))}
      </SidebarSection>
      {pluginErrors.length > 0 ? (
        <ul className={sessionList}>
          {pluginErrors.map((error) => (
            <li key={error.id}>
              <div className={pluginError} data-testid="plugin-error">
                {error.id}: {error.message}
              </div>
            </li>
          ))}
        </ul>
      ) : undefined}
      {pluginViews.map((plugin) => {
        if (plugin.Sidebar === undefined) return undefined;
        return (
          <div key={plugin.id} data-testid={`plugin-sidebar-${plugin.id}`}>
            <Router base={`/plugins/${plugin.id}`}>
              <PluginRuntimeProvider
                pluginId={plugin.id}
                server={pluginServers[plugin.id]}
              >
                <plugin.Sidebar />
              </PluginRuntimeProvider>
            </Router>
          </div>
        );
      })}
      <SidebarSection label="Develop">
        <SidebarItem href="/uikit">UI kit</SidebarItem>
      </SidebarSection>
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

function NewSessionButton({
  className,
  iconClassName,
}: {
  className: string;
  iconClassName: string;
}) {
  const [, navigate] = useLocation();
  return (
    <Button
      className={className}
      onClick={() => navigate(`/draft/${crypto.randomUUID()}`)}
    >
      <Icons.Plus className={iconClassName} aria-hidden="true" />
      New session
    </Button>
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
    spacing.padding({ x: 3 }),
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
  pluginError: style(
    text("xs", 500, "highContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      color: "light-dark(#b42318, #ff9592)",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    },
  ),
};
