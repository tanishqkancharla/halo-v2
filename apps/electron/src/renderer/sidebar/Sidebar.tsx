import {
  PluginServerProvider,
  Sidebar as NavigationSidebar,
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
import type { PluginLoadError } from "@repo/shared/contract";
import type { AppInfo, SessionSummary } from "@repo/shared/rpc";
import { useInstallAppUpdateMutation } from "../api/ApiProvider.tsx";
import type { LoadedPluginView } from "../evaluatePluginView.js";
import { FilesystemSection } from "./FilesystemSection.tsx";
import { SessionsSection } from "./SessionsSection.tsx";

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
  const navigation = useStyles(styles.navigation);
  const sessionList = useStyles(styles.sessionList);
  const footer = useStyles(styles.footer);
  const versionLabel = useStyles(styles.versionLabel);
  const updateLabel = useStyles(styles.updateLabel);
  const pluginError = useStyles(styles.pluginError);
  const newSessionPad = useStyles(sidebarPadding);

  return (
    <nav className={sidebar} aria-label="Workspace">
      <div className={titleBar} aria-hidden="true" />
      <div className={newSessionPad}>
        <NewSessionButton className={newButton} />
      </div>
      <NavigationSidebar aria-label="Workspace" className={navigation}>
        <FilesystemSection />
        <SessionsSection sessions={sessions} />
        {pluginViews.map((plugin) => {
          if (plugin.Sidebar === undefined) return undefined;
          return (
            <Router key={plugin.id} base={`/plugins/${plugin.id}`}>
              <PluginServerProvider
                pluginId={plugin.id}
                server={pluginServers[plugin.id]}
              >
                <plugin.Sidebar />
              </PluginServerProvider>
            </Router>
          );
        })}
      </NavigationSidebar>
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
  navigation: style(flexItem({ size: "auto" }), {
    minHeight: 0,
    overflow: "auto",
  }),
  restartButton: style({
    alignSelf: "stretch",
    width: "100%",
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
  versionLabel: style(
    text({ size: "xs", fontWeight: 500, color: "highContrast" }),
    {
      minWidth: 0,
    },
  ),
  updateLabel: style(
    text({ size: "xs", fontWeight: 400, color: "lowContrast" }),
    {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  ),
  pluginError: style(
    text({ size: "xs", fontWeight: 500, color: "highContrast" }),
    sidebarPadding,
    {
      color: "light-dark(#b42318, #ff9592)",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      paddingTop: spacing.value(2),
      paddingBottom: spacing.value(2),
    },
  ),
};
