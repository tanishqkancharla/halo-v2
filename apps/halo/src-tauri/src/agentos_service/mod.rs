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

use providers::configured_providers;
pub use sessions::{PromptResponse, SessionSummary};
use workspace::{ensure_workspace_home, VM_USER_ID};
pub use workspace::{WorkspaceEntry, WorkspaceLayout};

#[derive(Clone)]
pub struct StartupConfig {
    pub app_data_dir: PathBuf,
    pub sidecar_path: PathBuf,
    pub pi_package_path: PathBuf,
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
            Ok(os) => {
                let mut state = self.state.write().await;
                if matches!(&*state, ServiceState::Starting) {
                    *state = ServiceState::Ready(ReadyWorkspace { os, layout });
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
    ) -> Result<AgentOs, String> {
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
            packages: vec![PackageRef {
                path: config.pi_package_path.to_string_lossy().into_owned(),
            }],
            permissions: Some(Permissions {
                network: Some(PatternPermissions::Mode(PermissionMode::Allow)),
                ..Default::default()
            }),
            sidecar_binary_path: Some(config.sidecar_path.to_string_lossy().into_owned()),
            ..Default::default()
        })
        .await
        .map_err(|error| format!("AgentOS failed to start: {error}"))?;

        if let Err(error) = ensure_workspace_home(&os, layout).await {
            let _ = os.shutdown().await;
            return Err(error);
        }
        if let Err(error) = secure_file_if_present(&self.database_path) {
            let _ = os.shutdown().await;
            return Err(error);
        }
        Ok(os)
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
    ) -> Result<PromptResponse, String> {
        self.ready().await?.send_prompt(session_id, prompt).await
    }

    pub async fn list_sessions(&self) -> Result<Vec<SessionSummary>, String> {
        self.ready().await?.list_sessions().await
    }

    pub async fn read_history(&self, session_id: &str) -> Result<Vec<serde_json::Value>, String> {
        self.ready().await?.read_history(session_id).await
    }

    pub async fn shutdown(&self) {
        let previous = {
            let mut state = self.state.write().await;
            std::mem::replace(&mut *state, ServiceState::Stopped)
        };
        if let ServiceState::Ready(workspace) = previous {
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
        InlineExecutionOptions, JavaScriptExecutionOptions, JavaScriptModuleFormat,
        LanguageExecutionOptions, OpenSessionInput,
    };

    use super::providers::write_pi_settings;
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
                .send_prompt("session-1", "hello")
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
                .read_history("session-1")
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
        let sessions = restarted
            .list_sessions()
            .await
            .expect("list saved sessions");
        let session = sessions
            .iter()
            .find(|session| session.session_id == "restart-test")
            .expect("saved restart session");
        assert_eq!(session.cwd, "/halo/test-user");
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
        }
    }

    fn test_workspace_layout() -> WorkspaceLayout {
        WorkspaceLayout::new("test-user").expect("test workspace layout")
    }
}
