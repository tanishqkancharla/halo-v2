import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import {
  Button,
  Flex,
  H1,
  P,
  TextField,
  backgroundColor,
  colors,
  radius,
  shadow,
  spacing,
  text,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  getStartupPreference,
  listSessions,
  startWorkspace as startWorkspaceApi,
  type ReadyHealthStatus,
  type StartWorkspaceResult,
} from "./api.ts";
import { SessionsApp, type SessionSelection } from "./sessions/SessionsApp.tsx";

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
    ownerSlug = (await getStartupPreference()).lastOwnerSlug ?? "";
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
  const sessions = sessionsQuery.data ?? [];
  const activeSelection =
    selection ??
    (sessions[0]
      ? { kind: "saved" as const, sessionId: sessions[0].sessionId }
      : sessionsQuery.isFetched
        ? emptyDraft
        : undefined);
  const { resolvedTheme, setPreference } = useTheme();
  const readyApp = useStyles(readyAppClass);
  const errorClassName = useStyles(errorClass);

  if (workspaceQuery.isPending || !workspace) {
    return <WorkspaceLoading />;
  }

  if (workspace.status !== "ready") {
    return (
      <WorkspaceStart
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

  return (
    <div className={readyApp}>
      {(workspace.preferenceWarning || sessionsQuery.error) && (
        <div className={errorClassName} role="alert">
          {workspace.preferenceWarning || String(sessionsQuery.error)}
        </div>
      )}
      <SessionsApp
        sessions={sessions}
        selection={activeSelection}
        onSelectionChange={setSelection}
        onToggleTheme={() =>
          setPreference(resolvedTheme === "dark" ? "light" : "dark")
        }
        themeLabel={resolvedTheme === "dark" ? "Light" : "Dark"}
      />
    </div>
  );
}

function WorkspaceLoading() {
  const shell = useStyles(startShellClass);
  const card = useStyles(startCardClass);

  return (
    <main className={shell}>
      <section className={card} aria-live="polite">
        <H1>Opening workspace</H1>
        <P>Checking this device for your last username…</P>
      </section>
    </main>
  );
}

function WorkspaceStart({
  ownerSlug: initialOwnerSlug,
  message,
  isStarting,
  onStart,
  onChange,
}: {
  ownerSlug: string;
  message?: string;
  isStarting: boolean;
  onStart: (ownerSlug: string) => void;
  onChange: () => void;
}) {
  const [ownerSlug, setOwnerSlug] = useState(initialOwnerSlug);
  const shell = useStyles(startShellClass);
  const card = useStyles(startCardClass);
  const label = useStyles(labelClass);
  const error = useStyles(errorClass);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart(ownerSlug);
  }

  return (
    <main className={shell}>
      <section className={card}>
        <form onSubmit={submit}>
          <Flex column gap={8}>
            <div>
              <H1>Start workspace</H1>
              <P>Enter a username to open your workspace.</P>
            </div>
            <div>
              <label className={label} htmlFor="username">
                Username
              </label>
              <TextField
                id="username"
                value={ownerSlug}
                onChange={(value) => {
                  setOwnerSlug(value);
                  onChange();
                }}
                placeholder="tanishq"
                autoFocus
                isDisabled={isStarting}
                aria-describedby={message ? "username-error" : undefined}
                isInvalid={Boolean(message)}
              />
              {message && (
                <div className={error} id="username-error" role="alert">
                  {message}
                </div>
              )}
            </div>
            <Button type="submit" disabled={isStarting}>
              {isStarting ? "Starting…" : "Start workspace"}
            </Button>
          </Flex>
        </form>
      </section>
    </main>
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

const startShellClass = style(spacing.padding({ all: 12 }), {
  boxSizing: "border-box",
  display: "grid",
  placeItems: "center",
  minHeight: "100vh",
  backgroundColor: colors.gray[2],
});

const startCardClass = style(
  shadow.subtle,
  radius.lg,
  spacing.padding({ all: 12 }),
  {
    width: "min(100%, 440px)",
    minWidth: 0,
    backgroundColor: backgroundColor.element,
  },
);

const labelClass = style(text("xs", 500, "lowContrast"), {
  display: "block",
  marginBottom: spacing.value(2),
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
