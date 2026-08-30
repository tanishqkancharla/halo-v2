import {
  PluginServerProvider,
  SidebarItem,
  SidebarSection,
  sidebarPadding,
} from "@halo/plugin-sdk/view";
import type { AnyRouter, RouterClient } from "@orpc/server";
import {
  Button,
  Icons,
  colors,
  flex,
  flexItem,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { Router, useLocation } from "wouter";
import type { AppInfo, SessionSummary } from "../shared/rpc.ts";
import type { LoadedPluginView, PluginLoadError } from "../shared/plugin.js";
import { useInstallAppUpdateMutation } from "./api/ApiProvider.tsx";
import { WorkspaceFilesystem } from "./patterns/WorkspaceFilesystem.tsx";

type SidebarProps = {
  sessions: SessionSummary[];
  pluginViews: LoadedPluginView[];
  pluginErrors: PluginLoadError[];
  pluginServers: Record<string, RouterClient<AnyRouter>>;
  appInfo?: AppInfo;
};

export function Sidebar({
  sessions,
  pluginViews,
  pluginErrors,
  pluginServers,
  appInfo,
}: SidebarProps) {
  const sidebar = useStyles(styles.sidebar);
  const titleBar = useStyles(styles.titleBar);
  const newButton = useStyles(styles.newButton);
  const filesSection = useStyles(styles.filesSection);
  const sessionList = useStyles(styles.sessionList);
  const footer = useStyles(styles.footer);
  const versionLabel = useStyles(styles.versionLabel);
  const updateLabel = useStyles(styles.updateLabel);
  const pluginError = useStyles(styles.pluginError);
  const pluginSidebar = useStyles(styles.pluginSidebar);
  const newSessionPad = useStyles(sidebarPadding);

  return (
    <nav className={sidebar} aria-label="Sessions">
      <div className={titleBar} aria-hidden="true" />
      <div className={newSessionPad}>
        <NewSessionButton className={newButton} />
      </div>
      <WorkspaceFilesystem
        maxHeight={filesTreeMaxHeightPx}
        className={filesSection}
      />
      <SidebarSection label="Sessions">
        {sessions.map((session) => (
          <SidebarItem
            key={session.sessionId}
            href={`/sessions/${session.sessionId}`}
            pageTitle={session.title ? session.title : session.sessionId}
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
          <div
            key={plugin.id}
            data-testid={`plugin-sidebar-${plugin.id}`}
            className={pluginSidebar}
          >
            <Router base={`/plugins/${plugin.id}`}>
              <PluginServerProvider
                pluginId={plugin.id}
                server={pluginServers[plugin.id]}
              >
                <plugin.Sidebar />
              </PluginServerProvider>
            </Router>
          </div>
        );
      })}
      {appInfo !== undefined && (
        <div className={footer} data-testid="app-update-status">
          <div className={versionLabel}>Halo {appInfo.version}</div>
          <UpdateFooter appInfo={appInfo} labelClassName={updateLabel} />
        </div>
      )}
    </nav>
  );
}

function NewSessionButton({ className }: { className: string }) {
  const [, navigate] = useLocation();
  return (
    <Button
      className={className}
      onClick={() => navigate(`/draft/${crypto.randomUUID()}`)}
    >
      <Icons.Plus size="sm" aria-hidden="true" />
      New session
    </Button>
  );
}

function UpdateFooter({
  appInfo,
  labelClassName,
}: {
  appInfo: AppInfo;
  labelClassName: string;
}) {
  const install = useInstallAppUpdateMutation();
  const restartButton = useStyles(styles.restartButton);
  if (appInfo.update.state === "downloaded") {
    return (
      <Button
        className={restartButton}
        data-testid="app-update-restart"
        onClick={() => install.mutate()}
      >
        Restart to update
      </Button>
    );
  }
  return (
    <div className={labelClassName}>{formatUpdateStatus(appInfo.update)}</div>
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
const filesSectionBorderPx = 2;
const filesTreeMaxHeightPx =
  filesSectionMaxHeightPx -
  filesLabelLineHeightPx -
  Number.parseInt(spacing.value(4), 10) -
  Number.parseInt(spacing.value(2), 10) * 2 -
  filesSectionBorderPx;

const styles = {
  sidebar: style(shadow.medium, flex({ direction: "column", gap: 4 }), {
    width: "100%",
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    position: "relative",
    zIndex: 1,
    backgroundColor: `light-dark(${colors.gray[1]}, ${colors.gray[2]})`,
  }),
  titleBar: style({
    minHeight: "36px",
    flexShrink: 0,
    WebkitAppRegion: "drag",
  }),
  newButton: style(flex({ align: "center", gap: 3 }), {
    alignSelf: "stretch",
    width: "100%",
  }),
  restartButton: style({
    alignSelf: "stretch",
    width: "100%",
  }),
  filesSection: style(flexItem({ size: "hug" }), {
    minHeight: 0,
    maxHeight: `${filesSectionMaxHeightPx}px`,
    overflow: "hidden",
  }),
  sessionList: style(flex({ direction: "column" }), {
    listStyleType: "none",
    padding: 0,
    margin: 0,
    width: "100%",
    gap: "1px",
  }),
  footer: style(
    flex({ direction: "column", gap: 1 }),
    sidebarPadding,
    flexItem({ size: "hug" }),
    {
      marginTop: "auto",
      minWidth: 0,
      paddingTop: spacing.value(4),
      paddingBottom: spacing.value(8),
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
  pluginError: style(text("xs", 500, "highContrast"), sidebarPadding, {
    color: "light-dark(#b42318, #ff9592)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    paddingTop: spacing.value(2),
    paddingBottom: spacing.value(2),
  }),
  pluginSidebar: style({
    width: "100%",
    minWidth: 0,
  }),
};
