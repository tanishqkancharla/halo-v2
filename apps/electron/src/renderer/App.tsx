import { useState } from "react";
import { colors, spacing, text, useTheme } from "maui";
import { style, useStyles } from "purse-styles";
import {
  useSessionsQuery,
  useChooseWorkspaceMutation,
  useWorkspaceQuery,
  useAppInfoQuery,
} from "./api/ApiProvider.tsx";
import { LoadingPage } from "./LoadingPage.tsx";
import { MainPane } from "./MainPane.tsx";
import { Onboarding } from "./Onboarding.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { useLoadedExtensions } from "./useExtensions.ts";

export type SessionSelection =
  | { kind: "draft"; draftId: string }
  | { kind: "saved"; sessionId: string }
  | { kind: "uikit" }
  | { kind: "extension"; extensionId: string; viewId: string };

export function App() {
  const [selection, setSelection] = useState<SessionSelection>();
  const [emptyDraft] = useState<SessionSelection>(() => ({
    kind: "draft",
    draftId: crypto.randomUUID(),
  }));
  const workspaceQuery = useWorkspaceQuery();
  const workspace = workspaceQuery.data;
  const chooseWorkspace = useChooseWorkspaceMutation();
  const sessionsQuery = useSessionsQuery(workspace);
  const appInfoQuery = useAppInfoQuery();
  const { extensions, errors: extensionErrors } = useLoadedExtensions();
  const sessions = sessionsQuery.data === undefined ? [] : sessionsQuery.data;
  let activeSelection = selection;
  if (activeSelection === undefined && sessions[0]) {
    activeSelection = { kind: "saved", sessionId: sessions[0].sessionId };
  }
  if (
    activeSelection === undefined &&
    sessions[0] === undefined &&
    sessionsQuery.isFetched
  ) {
    activeSelection = emptyDraft;
  }
  const { resolvedTheme, setPreference } = useTheme();
  const readyApp = useStyles(styles.readyApp);
  const shell = useStyles(styles.shell);
  const errorClassName = useStyles(styles.error);

  if (workspaceQuery.isPending || !workspace) {
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

  const alertMessage = sessionsQuery.error
    ? String(sessionsQuery.error)
    : undefined;

  return (
    <div className={readyApp}>
      {alertMessage && (
        <div className={errorClassName} role="alert">
          {alertMessage}
        </div>
      )}
      <div className={shell} data-testid="sessions-shell">
        <Sidebar
          sessions={sessions}
          selection={activeSelection}
          onSelectionChange={setSelection}
          onToggleTheme={() =>
            setPreference(resolvedTheme === "dark" ? "light" : "dark")
          }
          themeLabel={resolvedTheme === "dark" ? "Light" : "Dark"}
          appInfo={appInfoQuery.data}
          extensionSections={extensions}
          extensionErrors={extensionErrors}
        />
        <MainPane
          selection={activeSelection}
          sessions={sessions}
          extensions={extensions}
          onDraftSent={(_draftId, sessionId) =>
            setSelection({ kind: "saved", sessionId })
          }
        />
      </div>
    </div>
  );
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
  error: style(text("xs", 500, "highContrast"), spacing.padding({ all: 4 }), {
    position: "relative",
    zIndex: 1,
    color: "light-dark(#b42318, #ff9592)",
    backgroundColor: "light-dark(#ffebe9, #3b1219)",
  }),
};
