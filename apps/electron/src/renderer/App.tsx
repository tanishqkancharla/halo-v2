import { useState } from "react";
import type { AnyRouter, RouterClient } from "@orpc/server";
import { colors } from "maui";
import { style, useStyles } from "purse-styles";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { AppInfo, SessionSummary } from "../shared/rpc.ts";
import type { LoadedPluginView, PluginLoadError } from "../shared/plugin.js";
import { LoadingPage } from "./LoadingPage.tsx";
import { MainPane } from "./MainPane.tsx";
import { Onboarding } from "./Onboarding.tsx";
import { Sidebar } from "./Sidebar.tsx";
import {
  useSessions,
  useChooseWorkspace,
  useWorkspace,
  useAppInfo,
  usePlugins,
} from "./api/ApiProvider.tsx";

export function App() {
  const workspace = useWorkspace();
  const chooseWorkspace = useChooseWorkspace();
  const sessions = useSessions();
  const appInfo = useAppInfo();
  const plugins = usePlugins();

  if (workspace === undefined) {
    return <LoadingPage />;
  }

  if (workspace.status !== "ready") {
    return (
      <Onboarding
        message={
          chooseWorkspace.error === undefined
            ? workspace.message
            : chooseWorkspace.error
        }
        isChoosing={chooseWorkspace.isChoosing}
        onChoose={() => chooseWorkspace.choose()}
      />
    );
  }

  return (
    <WorkspaceShell
      sessions={sessions}
      pluginViews={plugins.views}
      pluginErrors={plugins.errors}
      pluginServers={plugins.servers}
      appInfo={appInfo}
    />
  );
}

function WorkspaceShell({
  sessions,
  pluginViews,
  pluginErrors,
  pluginServers,
  appInfo,
}: {
  sessions: SessionSummary[];
  pluginViews: LoadedPluginView[];
  pluginErrors: PluginLoadError[];
  pluginServers: Record<string, RouterClient<AnyRouter>>;
  appInfo?: AppInfo;
}) {
  const [{ hook }] = useState(() =>
    memoryLocation({ path: initialHostPath(sessions) }),
  );
  const readyApp = useStyles(styles.readyApp);
  const shell = useStyles(styles.shell);

  return (
    <div className={readyApp}>
      <Router hook={hook}>
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
};
