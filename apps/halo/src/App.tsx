import { type FormEvent, useCallback, useEffect, useState } from "react";
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
  type SessionSummary,
  type StartWorkspaceResult,
} from "./api.ts";
import { SessionsApp, type SessionSelection } from "./sessions/SessionsApp.tsx";

type WorkspaceState =
  | { status: "restoring" }
  | { status: "needs-owner-slug"; ownerSlug: string }
  | { status: "starting"; ownerSlug: string }
  | { status: "error"; ownerSlug: string; message: string }
  | {
      status: "ready";
      health: ReadyHealthStatus;
      preferenceWarning?: string;
    };

let initialWorkspacePromise: Promise<WorkspaceState> | undefined;

function loadInitialWorkspace(): Promise<WorkspaceState> {
  initialWorkspacePromise ??= getStartupPreference().then(
    async ({ lastOwnerSlug }) => {
      if (!lastOwnerSlug) {
        return { status: "needs-owner-slug", ownerSlug: "" };
      }
      try {
        return readyWorkspace(await startWorkspaceApi(lastOwnerSlug));
      } catch (error) {
        return {
          status: "error",
          ownerSlug: lastOwnerSlug,
          message: String(error),
        };
      }
    },
    (error) => ({
      status: "error",
      ownerSlug: "",
      message: String(error),
    }),
  );
  return initialWorkspacePromise;
}

function readyWorkspace(result: StartWorkspaceResult): WorkspaceState {
  return {
    status: "ready",
    health: result.health,
    preferenceWarning: result.preferenceWarning,
  };
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    status: "restoring",
  });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selection, setSelection] = useState<SessionSelection>();
  const [catalogError, setCatalogError] = useState<string>();
  const { resolvedTheme, setPreference } = useTheme();
  const readyApp = useStyles(readyAppClass);
  const errorClassName = useStyles(errorClass);

  useEffect(() => {
    let active = true;
    void loadInitialWorkspace().then((state) => {
      if (active) setWorkspace(state);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const next = await listSessions();
      setSessions(next);
      setSelection(
        (current) =>
          current ??
          (next[0]
            ? { kind: "saved", sessionId: next[0].sessionId }
            : { kind: "draft", draftId: crypto.randomUUID() }),
      );
    } catch (error) {
      setCatalogError(String(error));
      setSelection(
        (current) => current ?? { kind: "draft", draftId: crypto.randomUUID() },
      );
    }
  }, []);

  useEffect(() => {
    if (workspace.status === "ready") void loadSessions();
  }, [loadSessions, workspace.status]);

  function changeOwnerSlug(ownerSlug: string) {
    setWorkspace((current) =>
      current.status === "ready" || current.status === "restoring"
        ? current
        : { status: "needs-owner-slug", ownerSlug },
    );
  }

  async function startWorkspace(ownerSlug: string) {
    setWorkspace({ status: "starting", ownerSlug });
    try {
      setWorkspace(readyWorkspace(await startWorkspaceApi(ownerSlug.trim())));
    } catch (error) {
      setWorkspace({ status: "error", ownerSlug, message: String(error) });
    }
  }

  if (workspace.status !== "ready") {
    return (
      <WorkspaceStart
        state={workspace}
        onOwnerSlugChange={changeOwnerSlug}
        onStart={(ownerSlug) => void startWorkspace(ownerSlug)}
      />
    );
  }

  return (
    <div className={readyApp}>
      {(workspace.preferenceWarning || catalogError) && (
        <div className={errorClassName} role="alert">
          {workspace.preferenceWarning || catalogError}
        </div>
      )}
      <SessionsApp
        sessions={sessions}
        selection={selection}
        onSelectionChange={setSelection}
        onToggleTheme={() =>
          setPreference(resolvedTheme === "dark" ? "light" : "dark")
        }
        themeLabel={resolvedTheme === "dark" ? "Light" : "Dark"}
      />
    </div>
  );
}

type WorkspaceStartState = Exclude<WorkspaceState, { status: "ready" }>;

function WorkspaceStart({
  state,
  onOwnerSlugChange,
  onStart,
}: {
  state: WorkspaceStartState;
  onOwnerSlugChange: (ownerSlug: string) => void;
  onStart: (ownerSlug: string) => void;
}) {
  const shell = useStyles(startShellClass);
  const card = useStyles(startCardClass);
  const label = useStyles(labelClass);
  const error = useStyles(errorClass);

  if (state.status === "restoring") {
    return (
      <main className={shell}>
        <section className={card} aria-live="polite">
          <H1>Opening workspace</H1>
          <P>Checking this device for your last username…</P>
        </section>
      </main>
    );
  }

  const isStarting = state.status === "starting";
  const message = state.status === "error" ? state.message : undefined;
  const ownerSlug = state.ownerSlug;

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
                onChange={onOwnerSlugChange}
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
