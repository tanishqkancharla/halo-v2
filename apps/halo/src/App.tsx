import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Badge,
  Button,
  Flex,
  H1,
  H2,
  P,
  Select,
  SelectItem,
  Spacer,
  TextField,
  backgroundColor,
  colors,
  focusRing,
  radius,
  shadow,
  shadowVars,
  spacing,
  text,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  createSession,
  getHealth,
  getStartupPreference,
  isReadyHealth,
  listSessions,
  listWorkspaceFiles,
  readSessionTranscript,
  readWorkspaceFile,
  sendPrompt,
  startWorkspace as startWorkspaceApi,
  writeWorkspaceFile,
  type ReadyHealthStatus,
  type SessionSummary,
  type SessionTranscript,
  type StartWorkspaceResult,
  type WorkspaceEntry,
} from "./api.ts";

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

const appClass = style({
  minHeight: "100vh",
  backgroundColor: colors.gray[2],
});

const shellClass = style(spacing.padding({ x: 12, y: 12 }), {
  width: "min(100%, 1120px)",
  marginInline: "auto",
});

const brandClass = style(text("sm", 600, "highContrast"));

const headerClass = style({
  minHeight: "40px",
});

const statusBarClass = style(
  shadow.subtle,
  radius.lg,
  spacing.padding({ all: 8 }),
  {
    marginTop: spacing.value(8),
    backgroundColor: backgroundColor.element,
  },
);

const statusDotClass = style(radius.circle, {
  width: "8px",
  height: "8px",
  flex: "0 0 auto",
});

const statusReadyClass = style({ backgroundColor: colors.accent[9] });

const statusCopyClass = style(text("xs", 400, "lowContrast"), {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const gridClass = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
  gap: spacing.value(8),
  marginTop: spacing.value(8),
  "@media (max-width: 780px)": {
    gridTemplateColumns: "1fr",
  },
});

const columnClass = style({
  display: "grid",
  alignContent: "start",
  gap: spacing.value(8),
});

const cardClass = style(
  shadow.subtle,
  radius.lg,
  spacing.padding({ all: 12 }),
  {
    minWidth: 0,
    backgroundColor: backgroundColor.element,
  },
);

const fieldLabelClass = style(text("xs", 500, "lowContrast"), {
  display: "block",
  marginBottom: spacing.value(2),
});

const textareaClass = style(
  text("sm", 400, "highContrast"),
  focusRing("&:focus-visible", shadowVars.subtle),
  shadow.subtle,
  radius.sm,
  spacing.padding({ x: 4, y: 4 }),
  {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "96px",
    resize: "vertical",
    border: "none",
    color: colors.gray[12],
    backgroundColor: backgroundColor.element,
  },
);

const outputClass = style(
  text("sm", 400, "highContrast"),
  radius.md,
  spacing.padding({ all: 6 }),
  {
    minHeight: "90px",
    maxHeight: "260px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    backgroundColor: colors.gray[3],
  },
);

const listClass = style(radius.md, {
  maxHeight: "190px",
  margin: 0,
  padding: 0,
  overflow: "auto",
  listStyle: "none",
  backgroundColor: colors.gray[3],
});

const listRowClass = style(
  text("xs", 400, "highContrast"),
  spacing.padding({ x: 6, y: 4 }),
  {
    borderBottom: `1px solid ${colors.gray[5]}`,
    overflowWrap: "anywhere",
    "&:last-child": { borderBottom: "none" },
  },
);

const sessionButtonClass = style(
  text("xs", 500, "highContrast"),
  spacing.padding({ x: 6, y: 4 }),
  {
    display: "block",
    width: "100%",
    border: "none",
    borderBottom: `1px solid ${colors.gray[5]}`,
    textAlign: "left",
    color: colors.gray[12],
    background: "transparent",
    cursor: "pointer",
    "&:hover": { backgroundColor: colors.gray[4] },
    "&[data-selected='true']": { backgroundColor: colors.accent[4] },
    "&:last-child": { borderBottom: "none" },
  },
);

const mutedClass = style(text("xs", 400, "lowContrast"));
const errorClass = style(
  text("xs", 500, "highContrast"),
  radius.md,
  spacing.padding({ all: 6 }),
  {
    marginTop: spacing.value(8),
    color: "light-dark(#b42318, #ff9592)",
    backgroundColor: "light-dark(#ffebe9, #3b1219)",
  },
);

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
  const card = useStyles(cardClass);
  const fieldLabel = useStyles(fieldLabelClass);
  const error = useStyles(errorClass);

  if (state.status === "restoring") {
    return (
      <section className={card} aria-live="polite">
        <H1>Opening workspace</H1>
        <P>Checking this device for your last username…</P>
      </section>
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
    <section className={card}>
      <form onSubmit={submit}>
        <Flex column gap={8}>
          <div>
            <H1>Start workspace</H1>
            <P>
              Enter a username. Halo will use it to open your workspace home.
            </P>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="username">
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
  );
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    status: "restoring",
  });
  const [files, setFiles] = useState<WorkspaceEntry[]>([]);
  const [fileContent, setFileContent] = useState(
    "Hello from Halo and AgentOS.\n",
  );
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState(
    "Reply with a short greeting and name the current directory.",
  );
  const [output, setOutput] = useState("No prompt sent yet.");
  const [transcript, setTranscript] = useState<SessionTranscript>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const { resolvedTheme, setPreference } = useTheme();
  const health = workspace.status === "ready" ? workspace.health : undefined;
  const helloPath = health?.workspaceRoot
    ? `${health.workspaceRoot}/hello.txt`
    : "";

  const classes = {
    app: useStyles(appClass),
    shell: useStyles(shellClass),
    brand: useStyles(brandClass),
    header: useStyles(headerClass),
    statusBar: useStyles(statusBarClass),
    statusDot: useStyles(statusDotClass),
    statusReady: useStyles(statusReadyClass),
    statusCopy: useStyles(statusCopyClass),
    grid: useStyles(gridClass),
    column: useStyles(columnClass),
    card: useStyles(cardClass),
    fieldLabel: useStyles(fieldLabelClass),
    textarea: useStyles(textareaClass),
    output: useStyles(outputClass),
    list: useStyles(listClass),
    listRow: useStyles(listRowClass),
    sessionButton: useStyles(sessionButtonClass),
    muted: useStyles(mutedClass),
    error: useStyles(errorClass),
  };

  const run = useCallback(
    async <T,>(name: string, action: () => Promise<T>) => {
      setBusy(name);
      setError(undefined);
      try {
        return await action();
      } catch (caught) {
        const message = String(caught);
        setError(message);
        throw caught;
      } finally {
        setBusy(undefined);
      }
    },
    [],
  );

  const refreshSessions = useCallback(async () => {
    const next = await listSessions();
    setSessions(next);
    setSelectedSessionId((current) => current || next[0]?.sessionId || "");
  }, []);

  const refreshFiles = useCallback(async () => {
    setFiles(await listWorkspaceFiles());
  }, []);

  const refresh = useCallback(async () => {
    const nextHealth = await getHealth();
    if (!isReadyHealth(nextHealth)) {
      throw new Error(nextHealth.error ?? "The workspace is no longer ready.");
    }
    const readyHealth: ReadyHealthStatus = nextHealth;
    setWorkspace((current) =>
      current.status === "ready"
        ? { ...current, health: readyHealth }
        : current,
    );
    const firstProvider = nextHealth.credentialProviders[0];
    if (firstProvider) {
      setProvider((current) =>
        nextHealth.credentialProviders.includes(current)
          ? current
          : firstProvider,
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadInitialWorkspace().then((state) => {
      if (active) setWorkspace(state);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (workspace.status !== "ready") return;

    const firstProvider = workspace.health.credentialProviders[0];
    if (firstProvider) {
      setProvider((current) =>
        workspace.health.credentialProviders.includes(current)
          ? current
          : firstProvider,
      );
    }
    void Promise.all([refreshFiles(), refreshSessions()]).catch((caught) =>
      setError(String(caught)),
    );
  }, [refreshFiles, refreshSessions, workspace]);

  useEffect(() => {
    if (!selectedSessionId) {
      setTranscript(undefined);
      return;
    }
    setTranscript(undefined);
    void readSessionTranscript(selectedSessionId)
      .then(setTranscript)
      .catch((caught) => setError(String(caught)));
  }, [selectedSessionId]);

  const statusLabel = health?.error ?? health?.status ?? "not started";
  const transcriptText = useMemo(
    () =>
      transcript
        ? JSON.stringify(transcript, null, 2)
        : "No completed history yet.",
    [transcript],
  );

  async function writeHello() {
    await run("write", async () => {
      if (!helloPath) throw new Error("Start a workspace first.");
      await writeWorkspaceFile(helloPath, fileContent);
      await refreshFiles();
    }).catch(() => undefined);
  }

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
      const result = await startWorkspaceApi(ownerSlug.trim());
      setWorkspace(readyWorkspace(result));
    } catch (caught) {
      setWorkspace({
        status: "error",
        ownerSlug,
        message: String(caught),
      });
    }
  }

  async function readHello() {
    await run("read", async () => {
      if (!helloPath) throw new Error("Start a workspace first.");
      setFileContent(await readWorkspaceFile(helloPath));
      await refreshFiles();
    }).catch(() => undefined);
  }

  async function openSession() {
    await run("session", async () => {
      const session = await createSession({
        sessionId: selectedSessionId || undefined,
        provider,
        model: model || undefined,
      });
      setSelectedSessionId(session.sessionId);
      await refreshSessions();
    }).catch(() => undefined);
  }

  async function submitPrompt() {
    await run("prompt", async () => {
      let sessionId = selectedSessionId;
      if (!sessionId) {
        const session = await createSession({
          provider,
          model: model || undefined,
        });
        sessionId = session.sessionId;
        setSelectedSessionId(sessionId);
      }
      const response = await sendPrompt(sessionId, prompt);
      setOutput(response.output || JSON.stringify(response.message, null, 2));
      await refreshSessions();
      setTranscript(await readSessionTranscript(sessionId));
    }).catch(() => undefined);
  }

  return (
    <main className={classes.app}>
      <div className={classes.shell}>
        <header className={classes.header}>
          <Flex row alignItems="center" gap={4}>
            <div className={classes.brand}>Halo</div>
            <Badge>AgentOS local proof</Badge>
            <Spacer />
            <Button
              variant="quiet"
              onClick={() =>
                setPreference(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? "Light" : "Dark"}
            </Button>
          </Flex>
        </header>

        {workspace.status !== "ready" ? (
          <WorkspaceStart
            state={workspace}
            onOwnerSlugChange={changeOwnerSlug}
            onStart={(ownerSlug) => void startWorkspace(ownerSlug)}
          />
        ) : (
          <>
            <section className={classes.statusBar} aria-label="AgentOS status">
              <Flex row alignItems="center" gap={4}>
                <span
                  className={`${classes.statusDot} ${classes.statusReady}`}
                  aria-hidden="true"
                />
                <strong>Sidecar: {statusLabel}</strong>
                <span className={classes.statusCopy}>
                  {health?.credentialConfigured
                    ? `Model key found: ${health.credentialProviders.join(", ")}`
                    : "No model key. File tools remain available."}
                </span>
                <Spacer />
                <Button
                  variant="quiet"
                  onClick={() => void refresh()}
                  disabled={Boolean(busy)}
                >
                  Refresh
                </Button>
              </Flex>
            </section>

            {workspace.preferenceWarning && (
              <div className={classes.error} role="status">
                {workspace.preferenceWarning}
              </div>
            )}
            {error && (
              <div className={classes.error} role="alert">
                {error}
              </div>
            )}

            <div className={classes.grid}>
              <div className={classes.column}>
                <section className={classes.card}>
                  <Flex column gap={8}>
                    <div>
                      <H2>Workspace file</H2>
                      <P>
                        Write and read {helloPath || "the workspace home"}{" "}
                        through the Rust client.
                      </P>
                    </div>
                    <div>
                      <label
                        className={classes.fieldLabel}
                        htmlFor="file-content"
                      >
                        File content
                      </label>
                      <textarea
                        id="file-content"
                        className={classes.textarea}
                        value={fileContent}
                        onChange={(event) => setFileContent(event.target.value)}
                      />
                    </div>
                    <Flex row gap={4}>
                      <Button
                        onClick={() => void writeHello()}
                        disabled={Boolean(busy)}
                      >
                        {busy === "write" ? "Writing…" : "Write file"}
                      </Button>
                      <Button
                        onClick={() => void readHello()}
                        disabled={Boolean(busy)}
                      >
                        {busy === "read" ? "Reading…" : "Read file"}
                      </Button>
                    </Flex>
                    <div>
                      <span className={classes.fieldLabel}>
                        Workspace entries
                      </span>
                      <ul className={classes.list}>
                        {files.length ? (
                          files.map((file) => (
                            <li className={classes.listRow} key={file.path}>
                              {file.isDirectory ? "Directory" : "File"}:{" "}
                              {file.name}
                            </li>
                          ))
                        ) : (
                          <li className={classes.listRow}>No files yet.</li>
                        )}
                      </ul>
                    </div>
                  </Flex>
                </section>

                <section className={classes.card}>
                  <Flex column gap={8}>
                    <div>
                      <H2>Saved sessions</H2>
                      <P>These rows come from AgentOS SQLite history.</P>
                    </div>
                    <div className={classes.list}>
                      {sessions.length ? (
                        sessions.map((session) => (
                          <button
                            type="button"
                            className={classes.sessionButton}
                            data-selected={
                              session.sessionId === selectedSessionId
                            }
                            key={session.sessionId}
                            onClick={() =>
                              setSelectedSessionId(session.sessionId)
                            }
                          >
                            {session.title || session.sessionId} ·{" "}
                            {session.state}
                          </button>
                        ))
                      ) : (
                        <div className={classes.listRow}>
                          No saved sessions.
                        </div>
                      )}
                    </div>
                    <div className={classes.output}>{transcriptText}</div>
                  </Flex>
                </section>
              </div>

              <div className={classes.column}>
                <section className={classes.card}>
                  <Flex column gap={8}>
                    <div>
                      <H1>Pi agent</H1>
                      <P>
                        Choose a provider and optional model, then open a
                        durable session.
                      </P>
                    </div>
                    <Select
                      label="Provider"
                      selectedKey={provider}
                      onSelectionChange={(key) => setProvider(String(key))}
                    >
                      <SelectItem id="anthropic">Anthropic</SelectItem>
                      <SelectItem id="openai">OpenAI</SelectItem>
                      <SelectItem id="google">Google Gemini</SelectItem>
                      <SelectItem id="openrouter">OpenRouter</SelectItem>
                    </Select>
                    <div>
                      <label
                        className={classes.fieldLabel}
                        htmlFor="model-name"
                      >
                        Model ID (optional)
                      </label>
                      <TextField
                        id="model-name"
                        value={model}
                        onChange={setModel}
                        placeholder="Use Pi's provider default"
                      />
                    </div>
                    <Button
                      onClick={() => void openSession()}
                      disabled={Boolean(busy)}
                    >
                      {busy === "session"
                        ? "Opening…"
                        : selectedSessionId
                          ? "Reopen selected session"
                          : "Create session"}
                    </Button>
                    <span className={classes.muted}>
                      {selectedSessionId
                        ? `Selected: ${selectedSessionId}`
                        : "No session selected."}
                    </span>
                  </Flex>
                </section>

                <section className={classes.card}>
                  <Flex column gap={8}>
                    <div>
                      <H2>Prompt</H2>
                      <P>
                        The key stays in Rust and never enters browser state.
                      </P>
                    </div>
                    <div>
                      <label className={classes.fieldLabel} htmlFor="prompt">
                        Message
                      </label>
                      <textarea
                        id="prompt"
                        className={classes.textarea}
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => void submitPrompt()}
                      disabled={Boolean(busy)}
                    >
                      {busy === "prompt" ? "Waiting for Pi…" : "Send prompt"}
                    </Button>
                    <div>
                      <span className={classes.fieldLabel}>
                        Completed output
                      </span>
                      <div className={classes.output} role="status">
                        {output}
                      </div>
                    </div>
                  </Flex>
                </section>
              </div>
            </div>

            <p className={classes.muted}>
              {health?.credentialStorage ??
                "AgentOS may store session environment values as plain text in agentos.sqlite."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
