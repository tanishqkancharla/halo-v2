import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { colors, spacing, text, useTheme } from "maui";
import { style, useStyles } from "purse-styles";
import { MainPane } from "./MainPane.tsx";
import { Onboarding } from "./Onboarding.tsx";
import { Sidebar } from "./Sidebar.tsx";
import {
  getStartupPreference,
  listSessions,
  startWorkspace as startWorkspaceApi,
  type ReadyHealthStatus,
  type StartWorkspaceResult,
} from "./api.ts";

export type SessionSelection =
  | { kind: "draft"; draftId: string }
  | { kind: "saved"; sessionId: string };

type WorkspaceState =
  | { status: "needs-owner-slug"; ownerSlug: string; message?: string }
  | {
      status: "ready";
      health: ReadyHealthStatus;
      preferenceWarning?: string;
    };

const workspaceQueryKey = ["workspace"] as const;

async function restoreWorkspace(): Promise<WorkspaceState> {
  let ownerSlug = "";
  try {
    const preference = await getStartupPreference();
    ownerSlug =
      preference.lastOwnerSlug === undefined ? "" : preference.lastOwnerSlug;
    if (!ownerSlug) return { status: "needs-owner-slug", ownerSlug };
    return readyWorkspace(await startWorkspaceApi(ownerSlug));
  } catch (error) {
    return {
      status: "needs-owner-slug",
      ownerSlug,
      message: String(error),
    };
  }
}

function readyWorkspace(result: StartWorkspaceResult): WorkspaceState {
  return {
    status: "ready",
    health: result.health,
    preferenceWarning: result.preferenceWarning,
  };
}

export function App() {
  const [selection, setSelection] = useState<SessionSelection>();
  const [emptyDraft] = useState<SessionSelection>(() => ({
    kind: "draft",
    draftId: crypto.randomUUID(),
  }));
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey,
    queryFn: restoreWorkspace,
  });
  const workspace = workspaceQuery.data;
  const startWorkspace = useMutation({
    mutationFn: (ownerSlug: string) => startWorkspaceApi(ownerSlug.trim()),
    onSuccess: (result) => {
      queryClient.setQueryData(workspaceQueryKey, readyWorkspace(result));
    },
  });
  const sessionsQuery = useQuery({
    queryKey: [
      "sessions",
      workspace?.status === "ready" ? workspace.health.workspaceRoot : null,
    ],
    queryFn: listSessions,
    enabled: workspace?.status === "ready",
  });
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
  const readyApp = useStyles(readyAppClass);
  const shell = useStyles(shellClass);
  const errorClassName = useStyles(errorClass);

  if (workspaceQuery.isPending) {
    return <Onboarding status="loading" />;
  }

  if (!workspace) {
    return <Onboarding status="loading" />;
  }

  if (workspace.status !== "ready") {
    return (
      <Onboarding
        status="start"
        ownerSlug={workspace.ownerSlug}
        message={
          startWorkspace.error
            ? String(startWorkspace.error)
            : workspace.message
        }
        isStarting={startWorkspace.isPending}
        onStart={startWorkspace.mutate}
        onChange={startWorkspace.reset}
      />
    );
  }

  const alertMessage = workspace.preferenceWarning
    ? workspace.preferenceWarning
    : sessionsQuery.error
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
        />
        <MainPane selection={activeSelection} sessions={sessions} />
      </div>
    </div>
  );
}

const readyAppClass = style({
  position: "relative",
  width: "100%",
  height: "100vh",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
});

const shellClass = style({
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
});

const errorClass = style(
  text("xs", 500, "highContrast"),
  spacing.padding({ all: 4 }),
  {
    position: "relative",
    zIndex: 1,
    color: "light-dark(#b42318, #ff9592)",
    backgroundColor: "light-dark(#ffebe9, #3b1219)",
  },
);
