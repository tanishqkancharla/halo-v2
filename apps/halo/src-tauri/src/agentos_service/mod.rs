mod execution;
mod providers;
mod sessions;
mod workspace;

use std::path::{Path, PathBuf};

use agentos_client::{
    AgentOs, AgentOsConfig, MountPlugin, PackageRef, PatternPermissions, PermissionMode,
    Permissions, RootFilesystemConfig, RootFilesystemKind, VmUserConfig,
};
use agentos_vm_config::VmSqliteDescriptor;
use serde::Serialize;
use serde_json::json;
use tokio::sync::RwLock;

use execution::ExecutionBridge;
use providers::configured_providers;
pub use sessions::{PromptResponse, PromptStreamEvent, SessionSummary, SessionTranscript};
use workspace::{ensure_workspace_home, install_code_mode, VM_USER_ID};
pub use workspace::{WorkspaceEntry, WorkspaceLayout};

#[derive(Clone)]
pub struct StartupConfig {
    pub app_data_dir: PathBuf,
    pub sidecar_path: PathBuf,
    pub pi_package_path: PathBuf,
    pub coreutils_package_path: PathBuf,
}

pub struct AgentOsService {
    state: RwLock<ServiceState>,
    database_path: PathBuf,
}

enum ServiceState {
    NotStarted,
    Starting,
    Ready(ReadyWorkspace),
    Failed(String),
    Stopped,
}

#[derive(Clone)]
struct ReadyWorkspace {
    os: AgentOs,
    execution: ExecutionBridge,
    layout: WorkspaceLayout,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub status: &'static str,
    pub sidecar_state: Option<String>,
    pub error: Option<String>,
    pub database_path: String,
    pub workspace_root: String,
    pub credential_configured: bool,
    pub credential_providers: Vec<String>,
    pub credential_storage: &'static str,
}

impl AgentOsService {
    pub fn new(app_data_dir: &Path) -> Self {
        Self {
            state: RwLock::new(ServiceState::NotStarted),
            database_path: app_data_dir.join("agentos.sqlite"),
        }
    }

    pub async fn initialize(
        &self,
        layout: WorkspaceLayout,
        config: StartupConfig,
    ) -> Result<(), String> {
        {
            let mut state = self.state.write().await;
            match &*state {
                ServiceState::NotStarted => *state = ServiceState::Starting,
                ServiceState::Starting => {
                    return Err("AgentOS is already starting.".to_owned());
                }
                ServiceState::Ready(_) => {
                    return Err("A workspace has already started.".to_owned());
                }
                ServiceState::Failed(_) => *state = ServiceState::Starting,
                ServiceState::Stopped => return Err("AgentOS has stopped.".to_owned()),
            }
        }

        match self.start(&layout, config).await {
            Ok((os, execution)) => {
                let mut state = self.state.write().await;
                if matches!(&*state, ServiceState::Starting) {
                    *state = ServiceState::Ready(ReadyWorkspace {
                        os,
                        execution,
                        layout,
                    });
                    return Ok(());
                }
                drop(state);
                let _ = os.shutdown().await;
                Err("AgentOS stopped during workspace startup.".to_owned())
            }
            Err(error) => {
                let mut state = self.state.write().await;
                if matches!(&*state, ServiceState::Starting) {
                    *state = ServiceState::Failed(error.clone());
                }
                Err(error)
            }
        }
    }

    async fn start(
        &self,
        layout: &WorkspaceLayout,
        config: StartupConfig,
    ) -> Result<(AgentOs, ExecutionBridge), String> {
        std::fs::create_dir_all(&config.app_data_dir)
            .map_err(|error| format!("Could not create the Halo data directory: {error}"))?;
        secure_directory(&config.app_data_dir)?;

        if !config.sidecar_path.is_file() {
            return Err(format!(
                "AgentOS sidecar is missing at {}",
                config.sidecar_path.display()
            ));
        }
        if !config.pi_package_path.is_file() {
            return Err(format!(
                "Pi package is missing at {}",
                config.pi_package_path.display()
            ));
        }
        if !config.coreutils_package_path.is_file() {
            return Err(format!(
                "AgentOS coreutils package is missing at {}",
                config.coreutils_package_path.display()
            ));
        }

        let execution = ExecutionBridge::new(layout.tools_module_path.clone());
        let os = AgentOs::create(AgentOsConfig {
            database: Some(VmSqliteDescriptor::SqliteFile {
                path: self.database_path.to_string_lossy().into_owned(),
            }),
            user: Some(VmUserConfig {
                uid: Some(VM_USER_ID),
                gid: Some(VM_USER_ID),
                euid: Some(VM_USER_ID),
                egid: Some(VM_USER_ID),
                homedir: Some(layout.root.clone()),
                ..Default::default()
            }),
            root_filesystem: RootFilesystemConfig {
                kind: RootFilesystemKind::Native,
                native_plugin: Some(MountPlugin {
                    id: "chunked_actor_sqlite".to_owned(),
                    config: Some(json!({ "namespace": "halo-workspace" })),
                }),
                ..Default::default()
            },
            packages: vec![
                PackageRef {
                    path: config.pi_package_path.to_string_lossy().into_owned(),
                },
                PackageRef {
                    path: config.coreutils_package_path.to_string_lossy().into_owned(),
                },
            ],
            bindings: execution.bindings(),
            permissions: Some(Permissions {
                network: Some(PatternPermissions::Mode(PermissionMode::Allow)),
                ..Default::default()
            }),
            sidecar_binary_path: Some(config.sidecar_path.to_string_lossy().into_owned()),
            ..Default::default()
        })
        .await
        .map_err(|error| format!("AgentOS failed to start: {error}"))?;
        execution.attach(os.clone()).await;

        if let Err(error) = ensure_workspace_home(&os, layout).await {
            let _ = os.shutdown().await;
            return Err(error);
        }
        if let Err(error) = install_code_mode(&os, layout).await {
            let _ = os.shutdown().await;
            return Err(error);
        }
        if let Err(error) = secure_file_if_present(&self.database_path) {
            let _ = os.shutdown().await;
            return Err(error);
        }
        Ok((os, execution))
    }

    pub async fn health(&self) -> HealthStatus {
        let credentials = configured_providers();
        let state = self.state.read().await;
        let (status, sidecar_state, error, workspace_root) = match &*state {
            ServiceState::NotStarted => ("not_started", None, None, String::new()),
            ServiceState::Starting => ("starting", None, None, String::new()),
            ServiceState::Ready(workspace) => (
                "ready",
                Some(workspace.os.sidecar().describe().state.as_str().to_owned()),
                None,
                workspace.layout.root.clone(),
            ),
            ServiceState::Failed(error) => ("error", None, Some(error.clone()), String::new()),
            ServiceState::Stopped => ("stopped", Some("disposed".to_owned()), None, String::new()),
        };

        HealthStatus {
            status,
            sidecar_state,
            error,
            database_path: self.database_path.to_string_lossy().into_owned(),
            workspace_root,
            credential_configured: !credentials.is_empty(),
            credential_providers: credentials
                .into_iter()
                .map(|provider| provider.id.to_owned())
                .collect(),
            credential_storage:
                "AgentOS may store session environment values as plain text in agentos.sqlite.",
        }
    }

    pub async fn write_file(&self, path: &str, content: &str) -> Result<(), String> {
        self.ready().await?.write_file(path, content).await
    }

    pub async fn read_file(&self, path: &str) -> Result<String, String> {
        self.ready().await?.read_file(path).await
    }

    pub async fn list_files(&self, path: Option<&str>) -> Result<Vec<WorkspaceEntry>, String> {
        self.ready().await?.list_files(path).await
    }

    pub async fn create_or_reopen_session(
        &self,
        session_id: Option<String>,
        provider_id: Option<String>,
        model: Option<String>,
    ) -> Result<SessionSummary, String> {
        self.ready()
            .await?
            .create_or_reopen_session(session_id, provider_id, model)
            .await
    }

    pub async fn send_prompt(
        &self,
        session_id: &str,
        prompt: &str,
        on_event: tauri::ipc::Channel<PromptStreamEvent>,
    ) -> Result<PromptResponse, String> {
        self.ready()
            .await?
            .send_prompt(session_id, prompt, on_event)
            .await
    }

    pub async fn list_sessions(&self) -> Result<Vec<SessionSummary>, String> {
        self.ready().await?.list_sessions().await
    }

    pub async fn read_transcript(&self, session_id: &str) -> Result<SessionTranscript, String> {
        self.ready().await?.read_transcript(session_id).await
    }

    pub async fn shutdown(&self) {
        let previous = {
            let mut state = self.state.write().await;
            std::mem::replace(&mut *state, ServiceState::Stopped)
        };
        if let ServiceState::Ready(workspace) = previous {
            workspace.execution.detach().await;
            let _ = workspace.os.shutdown().await;
        }
    }

    async fn ready(&self) -> Result<ReadyWorkspace, String> {
        match &*self.state.read().await {
            ServiceState::NotStarted => Err("Start a workspace first.".to_owned()),
            ServiceState::Ready(workspace) => Ok(workspace.clone()),
            ServiceState::Starting => {
                Err("AgentOS is still starting. Try again in a moment.".to_owned())
            }
            ServiceState::Failed(error) => Err(error.clone()),
            ServiceState::Stopped => Err("AgentOS has stopped.".to_owned()),
        }
    }
}

#[cfg(unix)]
fn secure_directory(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("Could not protect the Halo data directory: {error}"))
}

#[cfg(not(unix))]
fn secure_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn secure_file_if_present(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    if path.exists() {
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Could not protect agentos.sqlite: {error}"))?;
    }
    Ok(())
}

#[cfg(not(unix))]
fn secure_file_if_present(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::path::{Path, PathBuf};

    use agentos_client::{
        AgentOs, AgentOsConfig, Bindings, ExecOptions, InlineExecutionOptions,
        JavaScriptExecutionOptions, JavaScriptModuleFormat, LanguageExecutionOptions, MountPlugin,
        OpenSessionInput, PackageRef, RootFilesystemConfig, RootFilesystemKind, VmUserConfig,
    };
    use agentos_vm_config::VmSqliteDescriptor;
    use serde_json::json;

    use super::execution::ExecutionBridge;
    use super::providers::write_pi_settings;
    use super::workspace::{ensure_workspace_home, install_code_mode, VM_USER_ID};
    use super::{AgentOsService, StartupConfig, WorkspaceLayout};

    static SIDECAR_TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    #[tokio::test]
    async fn workspace_commands_require_start() {
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-idle-test-{}", uuid::Uuid::new_v4()));
        let service = AgentOsService::new(&data_dir);

        assert_eq!(
            service
                .write_file("/halo/test-user/test.txt", "test")
                .await
                .expect_err("write should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .read_file("/halo/test-user/test.txt")
                .await
                .expect_err("read should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .list_files(None)
                .await
                .expect_err("list files should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .create_or_reopen_session(None, None, None)
                .await
                .expect_err("create session should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .send_prompt("session-1", "hello", tauri::ipc::Channel::new(|_| Ok(())),)
                .await
                .expect_err("prompt should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .list_sessions()
                .await
                .expect_err("list sessions should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .read_transcript("session-1")
                .await
                .expect_err("history should require startup"),
            "Start a workspace first."
        );
    }

    #[tokio::test]
    async fn failed_workspace_start_can_retry() {
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-retry-test-{}", uuid::Uuid::new_v4()));
        let service = AgentOsService::new(&data_dir);

        for attempt in 1..=2 {
            let error = service
                .initialize(
                    test_workspace_layout(),
                    StartupConfig {
                        app_data_dir: data_dir.clone(),
                        sidecar_path: data_dir.join("missing-sidecar"),
                        pi_package_path: data_dir.join("missing-pi-package"),
                        coreutils_package_path: data_dir.join("missing-coreutils-package"),
                    },
                )
                .await
                .expect_err("missing sidecar should fail startup");
            assert!(
                error.contains("AgentOS sidecar is missing"),
                "attempt {attempt} returned the wrong error: {error}"
            );
        }

        std::fs::remove_dir_all(data_dir).expect("remove retry test data directory");
    }

    #[tokio::test]
    async fn workspace_file_survives_restart() {
        let _guard = SIDECAR_TEST_LOCK.lock().await;
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-test-{}", uuid::Uuid::new_v4()));
        let service = AgentOsService::new(&data_dir);
        service
            .initialize(test_workspace_layout(), test_startup_config(&data_dir))
            .await
            .expect("start workspace");
        let health = service.health().await;
        assert_eq!(health.status, "ready", "{:?}", health.error);
        assert_eq!(health.workspace_root, "/halo/test-user");
        service
            .write_file("/halo/test-user/persistent.txt", "still here")
            .await
            .expect("write persistent file");
        service.shutdown().await;

        let restarted = AgentOsService::new(&data_dir);
        restarted
            .initialize(test_workspace_layout(), test_startup_config(&data_dir))
            .await
            .expect("restart workspace");
        let health = restarted.health().await;
        assert_eq!(health.status, "ready", "{:?}", health.error);
        assert_eq!(health.workspace_root, "/halo/test-user");
        assert_eq!(
            restarted
                .read_file("/halo/test-user/persistent.txt")
                .await
                .expect("read persistent file"),
            "still here"
        );
        restarted.shutdown().await;
        std::fs::remove_dir_all(data_dir).expect("remove test data directory");
    }

    #[tokio::test]
    async fn execution_binding_evaluates_typescript() {
        let _guard = SIDECAR_TEST_LOCK.lock().await;
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-exec-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&data_dir).expect("create execution test data directory");
        let layout = test_workspace_layout();
        let execution = ExecutionBridge::new(layout.tools_module_path.clone());
        let os = AgentOs::create(test_agentos_config(
            &data_dir,
            &layout,
            execution.bindings(),
        ))
        .await
        .expect("start AgentOS");
        execution.attach(os.clone()).await;
        ensure_workspace_home(&os, &layout)
            .await
            .expect("create workspace home");
        install_code_mode(&os, &layout)
            .await
            .expect("install code-mode tools");

        let input = json!({
            "source": "console.log(process.cwd()); console.error('phase-one-stderr'); return 40 + 2;",
            "cwd": layout.root
        })
        .to_string();
        let result = os
            .exec_argv_process(
                "agentos-halo",
                &["exec".to_owned(), "--json".to_owned(), input],
                ExecOptions {
                    cwd: Some("/halo/test-user".to_owned()),
                    ..Default::default()
                },
            )
            .await
            .expect("invoke Halo execution binding");

        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        let output: serde_json::Value =
            serde_json::from_str(result.stdout.trim()).expect("parse binding output");
        assert_eq!(output["result"]["value"], json!(42));
        assert_eq!(
            output["result"]["execution"]["stdout"],
            json!(b"/halo/test-user\n")
        );
        assert_eq!(
            output["result"]["execution"]["stderr"],
            json!(b"phase-one-stderr\n")
        );

        let failure_input = json!({
            "source": "throw new Error('phase-one-failure');",
            "cwd": "/halo/test-user"
        })
        .to_string();
        let failure = os
            .exec_argv_process(
                "agentos-halo",
                &["exec".to_owned(), "--json".to_owned(), failure_input],
                ExecOptions {
                    cwd: Some("/halo/test-user".to_owned()),
                    ..Default::default()
                },
            )
            .await
            .expect("invoke failing Halo execution binding");

        assert_eq!(failure.exit_code, 1);
        assert!(
            failure.stderr.contains("phase-one-failure"),
            "{}",
            failure.stderr
        );

        execution.detach().await;
        os.shutdown().await.expect("shut down AgentOS");
        std::fs::remove_dir_all(data_dir).expect("remove execution test data directory");
    }

    #[tokio::test]
    async fn code_mode_tools_share_workspace() {
        let _guard = SIDECAR_TEST_LOCK.lock().await;
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-tools-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&data_dir).expect("create tools test data directory");
        let layout = test_workspace_layout();
        let execution = ExecutionBridge::new(layout.tools_module_path.clone());
        let os = AgentOs::create(test_agentos_config(
            &data_dir,
            &layout,
            execution.bindings(),
        ))
        .await
        .expect("start AgentOS");
        execution.attach(os.clone()).await;
        ensure_workspace_home(&os, &layout)
            .await
            .expect("create workspace home");
        install_code_mode(&os, &layout)
            .await
            .expect("install code-mode tools");

        let input = json!({
            "source": r#"
                await tools.files.write("notes.txt", "alpha\nbeta\n");
                const initial = await tools.files.read("notes.txt");
                await tools.files.edit("notes.txt", "beta", "edited");
                const patch = await tools.files.patch(`*** Begin Patch
*** Update File: notes.txt
@@
-alpha
+patched
*** End Patch`);
                const shell = await tools.shell.bash("printf shell-output");
                return {
                    initial,
                    final: await tools.files.read("notes.txt"),
                    patch,
                    shell,
                };
            "#,
            "cwd": layout.root
        })
        .to_string();
        let result = os
            .exec_argv_process(
                "agentos-halo",
                &["exec".to_owned(), "--json".to_owned(), input],
                ExecOptions {
                    cwd: Some("/halo/test-user".to_owned()),
                    ..Default::default()
                },
            )
            .await
            .expect("invoke code-mode tools");

        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        let output: serde_json::Value =
            serde_json::from_str(result.stdout.trim()).expect("parse tools output");
        let value = &output["result"]["value"];
        assert_eq!(value["initial"], json!("alpha\nbeta\n"));
        assert_eq!(value["final"], json!("patched\nedited\n"));
        assert_eq!(
            value["patch"],
            json!("Updated the following files:\nM notes.txt")
        );
        assert_eq!(value["shell"]["stdout"], json!("shell-output"));
        assert_eq!(value["shell"]["stderr"], json!(""));
        assert_eq!(value["shell"]["exitCode"], json!(0));
        assert_eq!(
            os.read_file("/halo/test-user/notes.txt")
                .await
                .expect("read tools result"),
            b"patched\nedited\n"
        );

        execution.detach().await;
        os.shutdown().await.expect("shut down AgentOS");
        std::fs::remove_dir_all(data_dir).expect("remove tools test data directory");
    }

    #[tokio::test]
    async fn session_catalog_survives_restart_without_model_call() {
        let _guard = SIDECAR_TEST_LOCK.lock().await;
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-test-{}", uuid::Uuid::new_v4()));
        let service = AgentOsService::new(&data_dir);
        service
            .initialize(test_workspace_layout(), test_startup_config(&data_dir))
            .await
            .expect("start workspace");
        let health = service.health().await;
        assert_eq!(health.status, "ready", "{:?}", health.error);

        let mut env = BTreeMap::new();
        let workspace = service.ready().await.expect("ready workspace");
        let installed_tools = service
            .read_file("/halo/test-user/tools/index.mjs")
            .await
            .expect("read installed code-mode tools");
        let installed_extension = service
            .read_file("/halo/test-user/.pi/agent/extensions/halo-exec.js")
            .await
            .expect("read installed Pi extension");
        assert!(installed_tools.contains("export function createTools"));
        assert!(installed_extension.contains("pi.setActiveTools([\"exec\"]);"));
        write_pi_settings(
            &workspace.os,
            &workspace.layout,
            "openai",
            Some("test-model"),
        )
        .await
        .expect("write Pi settings");
        let settings = service
            .read_file("/halo/test-user/.pi/agent/settings.json")
            .await
            .expect("read Pi settings");
        assert!(settings.contains("\"defaultProvider\":\"openai\""));
        assert!(settings.contains("\"defaultModel\":\"test-model\""));
        service
            .write_file("/halo/test-user/shared-write.txt", "halo")
            .await
            .expect("write file through Halo");
        let write_probe = workspace
            .os
            .execute_javascript(
                "require('fs').writeFileSync('/halo/test-user/shared-write.txt', 'agent');",
                JavaScriptExecutionOptions {
                    inline: InlineExecutionOptions {
                        process: LanguageExecutionOptions {
                            cwd: Some(workspace.layout.root.clone()),
                            ..Default::default()
                        },
                        ..Default::default()
                    },
                    format: JavaScriptModuleFormat::CommonJs,
                    ..Default::default()
                },
            )
            .await
            .expect("run agent write probe");
        assert_eq!(write_probe.exit_code, Some(0), "agent can write in home");
        assert_eq!(
            service
                .read_file("/halo/test-user/shared-write.txt")
                .await
                .expect("read agent edit"),
            "agent"
        );
        env.insert("HOME".to_owned(), workspace.layout.root.clone());
        env.insert("OPENAI_API_KEY".to_owned(), "test-key-not-real".to_owned());
        env.insert("PI_SKIP_VERSION_CHECK".to_owned(), "1".to_owned());
        env.insert("PI_TELEMETRY".to_owned(), "0".to_owned());
        workspace
            .os
            .open_session(OpenSessionInput {
                session_id: Some("restart-test".to_owned()),
                agent: "pi".to_owned(),
                cwd: Some(workspace.layout.root),
                additional_directories: None,
                env: Some(env),
                mcp_servers: None,
                permission_policy: None,
                skip_os_instructions: None,
                additional_instructions: None,
            })
            .await
            .expect("open Pi session without sending a prompt");
        service.shutdown().await;

        let restarted = AgentOsService::new(&data_dir);
        restarted
            .initialize(test_workspace_layout(), test_startup_config(&data_dir))
            .await
            .expect("restart workspace");
        assert_eq!(
            restarted
                .read_file("/halo/test-user/tools/index.mjs")
                .await
                .expect("read restarted code-mode tools"),
            installed_tools
        );
        assert_eq!(
            restarted
                .read_file("/halo/test-user/.pi/agent/extensions/halo-exec.js")
                .await
                .expect("read restarted Pi extension"),
            installed_extension
        );
        let sessions = restarted
            .list_sessions()
            .await
            .expect("list saved sessions");
        let session = sessions
            .iter()
            .find(|session| session.session_id == "restart-test")
            .expect("saved restart session");
        assert_eq!(session.cwd, "/halo/test-user");
        let transcript = restarted
            .read_transcript("restart-test")
            .await
            .expect("read empty saved transcript");
        assert!(transcript.messages.is_empty());
        assert!(!transcript.has_more_before);
        assert!(!transcript.has_more_after);

        let restarted_workspace = restarted.ready().await.expect("ready restarted workspace");
        let input = json!({
            "source": "await tools.files.write('after-restart.txt', 'written through exec'); return await tools.files.read('after-restart.txt');",
            "cwd": restarted_workspace.layout.root
        })
        .to_string();
        let result = restarted_workspace
            .os
            .exec_argv_process(
                "agentos-halo",
                &["exec".to_owned(), "--json".to_owned(), input],
                ExecOptions {
                    cwd: Some("/halo/test-user".to_owned()),
                    ..Default::default()
                },
            )
            .await
            .expect("invoke execution binding after restart");
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        let output: serde_json::Value =
            serde_json::from_str(result.stdout.trim()).expect("parse restarted binding output");
        assert_eq!(output["result"]["value"], json!("written through exec"));
        assert_eq!(
            restarted
                .read_file("/halo/test-user/after-restart.txt")
                .await
                .expect("read restarted binding write"),
            "written through exec"
        );
        restarted.shutdown().await;
        std::fs::remove_dir_all(data_dir).expect("remove test data directory");
    }

    fn test_startup_config(data_dir: &Path) -> StartupConfig {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        StartupConfig {
            app_data_dir: data_dir.to_owned(),
            sidecar_path: manifest_dir
                .join("binaries")
                .join(format!("agentos-sidecar-{}", env!("HALO_TARGET"))),
            pi_package_path: manifest_dir
                .join("../node_modules/@agentos-software/pi/dist/package.aospkg"),
            coreutils_package_path: manifest_dir
                .join("../node_modules/@agentos-software/coreutils/dist/package.aospkg"),
        }
    }

    fn test_agentos_config(
        data_dir: &Path,
        layout: &WorkspaceLayout,
        bindings: Vec<Bindings>,
    ) -> AgentOsConfig {
        AgentOsConfig {
            database: Some(VmSqliteDescriptor::SqliteFile {
                path: data_dir
                    .join("agentos.sqlite")
                    .to_string_lossy()
                    .into_owned(),
            }),
            user: Some(VmUserConfig {
                uid: Some(VM_USER_ID),
                gid: Some(VM_USER_ID),
                euid: Some(VM_USER_ID),
                egid: Some(VM_USER_ID),
                homedir: Some(layout.root.clone()),
                ..Default::default()
            }),
            root_filesystem: RootFilesystemConfig {
                kind: RootFilesystemKind::Native,
                native_plugin: Some(MountPlugin {
                    id: "chunked_actor_sqlite".to_owned(),
                    config: Some(json!({ "namespace": "halo-execution-test" })),
                }),
                ..Default::default()
            },
            bindings,
            sidecar_binary_path: Some(
                test_startup_config(data_dir)
                    .sidecar_path
                    .to_string_lossy()
                    .into_owned(),
            ),
            packages: vec![PackageRef {
                path: test_startup_config(data_dir)
                    .coreutils_package_path
                    .to_string_lossy()
                    .into_owned(),
            }],
            ..Default::default()
        }
    }

    fn test_workspace_layout() -> WorkspaceLayout {
        WorkspaceLayout::new("test-user").expect("test workspace layout")
    }
}
