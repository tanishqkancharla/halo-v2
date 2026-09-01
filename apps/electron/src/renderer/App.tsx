import { useState } from "react";
import type { AnyRouter, RouterClient } from "@orpc/server";
import { colors, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { AppInfo, SessionSummary } from "../shared/rpc.ts";
import { SidebarNavigationProvider } from "@halo/plugin-sdk/view";
import type { LoadedPluginView, PluginLoadError } from "../shared/plugin.js";
import { LoadingPage } from "./LoadingPage.tsx";
import { MainPane } from "./main/MainPane.tsx";
import { Onboarding } from "./Onboarding.tsx";
import { Sidebar } from "./sidebar/Sidebar.tsx";
import {
  useSessionsQuery,
  useChooseWorkspaceMutation,
  useWorkspaceQuery,
  useAppInfoQuery,
  usePluginsQuery,
} from "./api/ApiProvider.tsx";

export function App() {
  const workspaceQuery = useWorkspaceQuery();
  const workspace = workspaceQuery.data;
  const chooseWorkspace = useChooseWorkspaceMutation();
  const sessionsQuery = useSessionsQuery(workspace);
  const appInfoQuery = useAppInfoQuery();
  const pluginsQuery = usePluginsQuery(workspace);
  const sessions = sessionsQuery.data === undefined ? [] : sessionsQuery.data;
  const pluginViews =
    pluginsQuery.data === undefined ? [] : pluginsQuery.data.views;
  const pluginErrors =
    pluginsQuery.data === undefined ? [] : pluginsQuery.data.errors;
  const pluginServers =
    pluginsQuery.data === undefined ? {} : pluginsQuery.data.servers;

  if (workspaceQuery.isPending || workspace === undefined) {
    return <LoadingPage />;
  }

  if (workspace.status !== "ready") {
    return (
      <Onboarding
        message={
          chooseWorkspace.error
            ? String(chooseWorkspace.error)
            : workspace.message
        }
        isChoosing={chooseWorkspace.isPending}
        onChoose={() => chooseWorkspace.mutate()}
      />
    );
  }

  if (!sessionsQuery.isFetched || !pluginsQuery.isFetched) {
    return <LoadingPage />;
  }

  return (
    <WorkspaceShell
      sessions={sessions}
      pluginViews={pluginViews}
      pluginErrors={pluginErrors}
      pluginServers={pluginServers}
      alertMessage={
        sessionsQuery.error ? String(sessionsQuery.error) : undefined
      }
      appInfo={appInfoQuery.data}
    />
  );
}

function WorkspaceShell({
  sessions,
  pluginViews,
  pluginErrors,
  pluginServers,
  alertMessage,
  appInfo,
}: {
  sessions: SessionSummary[];
  pluginViews: LoadedPluginView[];
  pluginErrors: PluginLoadError[];
  pluginServers: Record<string, RouterClient<AnyRouter>>;
  alertMessage?: string;
  appInfo?: AppInfo;
}) {
  const [{ hook }] = useState(() =>
    memoryLocation({ path: initialHostPath(sessions) }),
  );
  const readyApp = useStyles(styles.readyApp);
  const shell = useStyles(styles.shell);
  const errorClassName = useStyles(styles.error);

  return (
    <div className={readyApp}>
      {alertMessage && (
        <div className={errorClassName} role="alert">
          {alertMessage}
        </div>
      )}
      <Router hook={hook}>
        <SidebarNavigationProvider>
          <div className={shell} data-testid="sessions-shell">
            <Sidebar
              sessions={sessions}
              pluginViews={pluginViews}
              pluginErrors={pluginErrors}
              pluginServers={pluginServers}
              appInfo={appInfo}
            />
            <MainPane
              sessions={sessions}
              pluginViews={pluginViews}
              pluginServers={pluginServers}
            />
          </div>
        </SidebarNavigationProvider>
      </Router>
    </div>
  );
}

function initialHostPath(sessions: SessionSummary[]) {
  const first = sessions[0];
  if (first !== undefined) return `/sessions/${first.sessionId}`;
  return `/draft/${crypto.randomUUID()}`;
}

const styles = {
  readyApp: style({
    position: "relative",
    width: "100%",
    height: "100vh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  }),
  shell: style({
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
  }),
  error: style(
    text({ size: "xs", fontWeight: 500, color: "highContrast" }),
    spacing.padding({ all: 4 }),
    {
      position: "relative",
      zIndex: 1,
      color: "light-dark(#b42318, #ff9592)",
      backgroundColor: "light-dark(#ffebe9, #3b1219)",
    },
  ),
};
