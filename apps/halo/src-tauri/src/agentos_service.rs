use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use agentos_client::{
    AgentOs, AgentOsConfig, ListSessionsInput, MkdirOptions, MountPlugin, OpenSessionInput,
    PackageRef, PatternPermissions, PermissionMode, Permissions, PromptInput, ReadHistoryInput,
    RootFilesystemConfig, RootFilesystemKind,
};
use agentos_vm_config::VmSqliteDescriptor;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::RwLock;

const WORKSPACE_ROOT: &str = "/home/agentos";
const PI_CONFIG_DIR: &str = "/home/agentos/.pi/agent";
const PI_SETTINGS_PATH: &str = "/home/agentos/.pi/agent/settings.json";
const MAX_USERNAME_LENGTH: usize = 64;

const PROVIDERS: [Provider; 4] = [
    Provider {
        id: "anthropic",
        env_name: "ANTHROPIC_API_KEY",
    },
    Provider {
        id: "openai",
        env_name: "OPENAI_API_KEY",
    },
    Provider {
        id: "google",
        env_name: "GEMINI_API_KEY",
    },
    Provider {
        id: "openrouter",
        env_name: "OPENROUTER_API_KEY",
    },
];

#[derive(Clone)]
struct Provider {
    id: &'static str,
    env_name: &'static str,
}

#[derive(Clone)]
pub struct StartupConfig {
    pub app_data_dir: PathBuf,
    pub sidecar_path: PathBuf,
    pub pi_package_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceLayout {
    root: String,
    files: String,
    pi_config_dir: String,
    pi_settings_path: String,
}

impl WorkspaceLayout {
    pub fn new(username: &str) -> Result<Self, String> {
        if username.is_empty()
            || username.len() > MAX_USERNAME_LENGTH
            || !username.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
            })
        {
            return Err(format!(
                "Usernames must be 1 to {MAX_USERNAME_LENGTH} ASCII letters, numbers, '-' or '_' only."
            ));
        }

        let root = format!("/halo/{username}");
        let files = format!("{root}/files");
        let pi_config_dir = format!("{files}/.pi/agent");
        let pi_settings_path = format!("{pi_config_dir}/settings.json");
        Ok(Self {
            root,
            files,
            pi_config_dir,
            pi_settings_path,
        })
    }
}

pub struct AgentOsService {
    state: RwLock<ServiceState>,
    database_path: PathBuf,
}

enum ServiceState {
    NotStarted,
    Starting,
    Ready {
        os: AgentOs,
        #[allow(dead_code)]
        layout: WorkspaceLayout,
    },
    Failed(String),
    Stopped,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub status: &'static str,
    pub sidecar_state: Option<String>,
    pub error: Option<String>,
    pub database_path: String,
    pub workspace_root: &'static str,
    pub credential_configured: bool,
    pub credential_providers: Vec<String>,
    pub credential_storage: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub is_symbolic_link: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub session_id: String,
    pub agent: String,
    pub cwd: String,
    pub state: String,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptResponse {
    pub session_id: String,
    pub output: String,
    pub message: Value,
    pub stop_reason: Value,
}

impl AgentOsService {
    pub fn new(app_data_dir: &Path) -> Arc<Self> {
        Arc::new(Self {
            state: RwLock::new(ServiceState::NotStarted),
            database_path: app_data_dir.join("agentos.sqlite"),
        })
    }

    pub async fn initialize(
        self: &Arc<Self>,
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
                ServiceState::Ready { .. } => {
                    return Err("A workspace has already started.".to_owned());
                }
                ServiceState::Failed(error) => {
                    return Err(format!("Workspace startup already failed: {error}"));
                }
                ServiceState::Stopped => return Err("AgentOS has stopped.".to_owned()),
            }
        }

        match self.start(config).await {
            Ok(os) => {
                let should_shutdown = {
                    let mut state = self.state.write().await;
                    if matches!(&*state, ServiceState::Starting) {
                        *state = ServiceState::Ready {
                            os: os.clone(),
                            layout,
                        };
                        false
                    } else {
                        true
                    }
                };
                if should_shutdown {
                    let _ = os.shutdown().await;
                    return Err("AgentOS stopped during workspace startup.".to_owned());
                }
                Ok(())
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

    async fn start(&self, config: StartupConfig) -> Result<AgentOs, String> {
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

        secure_file_if_present(&self.database_path)?;
        Ok(os)
    }

    pub async fn health(&self) -> HealthStatus {
        let credentials = configured_providers();
        let state = self.state.read().await;
        let (status, sidecar_state, error) = match &*state {
            ServiceState::NotStarted => ("not_started", None, None),
            ServiceState::Starting => ("starting", None, None),
            ServiceState::Ready { os, .. } => (
                "ready",
                Some(os.sidecar().describe().state.as_str().to_owned()),
                None,
            ),
            ServiceState::Failed(error) => ("error", None, Some(error.clone())),
            ServiceState::Stopped => ("stopped", Some("disposed".to_owned()), None),
        };

        HealthStatus {
            status,
            sidecar_state,
            error,
            database_path: self.database_path.to_string_lossy().into_owned(),
            workspace_root: WORKSPACE_ROOT,
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
        let os = self.ready().await?;
        let path = validate_workspace_path(path)?;
        os.write_file(&path, content)
            .await
            .map_err(|error| safe_client_error("Could not write the file", error))
    }

    pub async fn read_file(&self, path: &str) -> Result<String, String> {
        let os = self.ready().await?;
        let path = validate_workspace_path(path)?;
        let bytes = os
            .read_file(&path)
            .await
            .map_err(|error| safe_client_error("Could not read the file", error))?;
        String::from_utf8(bytes).map_err(|_| "The file is not valid UTF-8 text.".to_owned())
    }

    pub async fn list_files(&self, path: Option<&str>) -> Result<Vec<WorkspaceEntry>, String> {
        let os = self.ready().await?;
        let path = validate_workspace_path(path.unwrap_or(WORKSPACE_ROOT))?;
        let mut entries = os
            .read_dir_with_types(&path)
            .await
            .map_err(|error| safe_client_error("Could not list the directory", error))?
            .into_iter()
            .map(|entry| WorkspaceEntry {
                path: format!("{}/{}", path.trim_end_matches('/'), entry.name),
                name: entry.name,
                is_directory: entry.is_directory,
                is_symbolic_link: entry.is_symbolic_link,
            })
            .collect::<Vec<_>>();
        entries.sort_by(|left, right| left.name.cmp(&right.name));
        Ok(entries)
    }

    pub async fn create_or_reopen_session(
        &self,
        session_id: Option<String>,
        provider_id: Option<String>,
        model: Option<String>,
    ) -> Result<SessionSummary, String> {
        let os = self.ready().await?;
        let session_id = session_id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("session-{}", uuid::Uuid::new_v4()));
        validate_session_id(&session_id)?;

        if let Ok(existing) = os.get_session(Some(&session_id)).await {
            return Ok(session_summary(existing));
        }

        let provider = select_provider(provider_id.as_deref())?;
        let key = std::env::var(provider.env_name)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(missing_credential_error)?;

        write_pi_settings(&os, provider.id, model.as_deref()).await?;

        let mut env = BTreeMap::new();
        env.insert("HOME".to_owned(), WORKSPACE_ROOT.to_owned());
        env.insert(provider.env_name.to_owned(), key);
        env.insert("PI_SKIP_VERSION_CHECK".to_owned(), "1".to_owned());
        env.insert("PI_TELEMETRY".to_owned(), "0".to_owned());

        os.open_session(OpenSessionInput {
            session_id: Some(session_id.clone()),
            agent: "pi".to_owned(),
            cwd: Some(WORKSPACE_ROOT.to_owned()),
            additional_directories: None,
            env: Some(env),
            mcp_servers: None,
            permission_policy: None,
            skip_os_instructions: None,
            additional_instructions: None,
        })
        .await
        .map_err(|error| safe_client_error("Could not open the Pi session", error))?;

        let session = os
            .get_session(Some(&session_id))
            .await
            .map_err(|error| safe_client_error("Could not read the new session", error))?;
        Ok(session_summary(session))
    }

    pub async fn send_prompt(
        &self,
        session_id: &str,
        prompt: &str,
    ) -> Result<PromptResponse, String> {
        let os = self.ready().await?;
        validate_session_id(session_id)?;
        if prompt.trim().is_empty() {
            return Err("Enter a prompt first.".to_owned());
        }
        if configured_providers().is_empty() {
            return Err(missing_credential_error());
        }

        let content = serde_json::from_value(json!({ "type": "text", "text": prompt }))
            .map_err(|error| format!("Could not build the prompt: {error}"))?;
        let result = os
            .prompt(PromptInput {
                session_id: Some(session_id.to_owned()),
                idempotency_key: Some(uuid::Uuid::new_v4().to_string()),
                content: vec![content],
            })
            .await
            .map_err(|error| safe_client_error("The Pi prompt failed", error))?;

        let message = serde_json::to_value(&result.message)
            .map_err(|error| format!("Could not encode the Pi response: {error}"))?;
        let stop_reason = serde_json::to_value(result.stop_reason)
            .map_err(|error| format!("Could not encode the stop reason: {error}"))?;
        let output = collect_text(&message);

        Ok(PromptResponse {
            session_id: result.session_id,
            output,
            message,
            stop_reason,
        })
    }

    pub async fn list_sessions(&self) -> Result<Vec<SessionSummary>, String> {
        let os = self.ready().await?;
        let page = os
            .list_sessions(ListSessionsInput {
                cursor: None,
                limit: Some(200),
            })
            .await
            .map_err(|error| safe_client_error("Could not list sessions", error))?;
        Ok(page.sessions.into_iter().map(session_summary).collect())
    }

    pub async fn read_history(&self, session_id: &str) -> Result<Vec<Value>, String> {
        let os = self.ready().await?;
        validate_session_id(session_id)?;
        let page = os
            .read_history(ReadHistoryInput {
                session_id: Some(session_id.to_owned()),
                before: None,
                after: None,
                limit: Some(500),
            })
            .await
            .map_err(|error| safe_client_error("Could not read session history", error))?;
        page.events
            .into_iter()
            .map(|event| {
                serde_json::to_value(event)
                    .map_err(|error| format!("Could not encode session history: {error}"))
            })
            .collect()
    }

    pub async fn shutdown(&self) {
        let previous = {
            let mut state = self.state.write().await;
            std::mem::replace(&mut *state, ServiceState::Stopped)
        };
        if let ServiceState::Ready { os, .. } = previous {
            let _ = os.shutdown().await;
        }
    }

    async fn ready(&self) -> Result<AgentOs, String> {
        match &*self.state.read().await {
            ServiceState::NotStarted => Err("Start a workspace first.".to_owned()),
            ServiceState::Ready { os, .. } => Ok(os.clone()),
            ServiceState::Starting => {
                Err("AgentOS is still starting. Try again in a moment.".to_owned())
            }
            ServiceState::Failed(error) => Err(error.clone()),
            ServiceState::Stopped => Err("AgentOS has stopped.".to_owned()),
        }
    }
}

async fn write_pi_settings(
    os: &AgentOs,
    provider: &str,
    model: Option<&str>,
) -> Result<(), String> {
    os.mkdir(PI_CONFIG_DIR, MkdirOptions { recursive: true })
        .await
        .map_err(|error| safe_client_error("Could not create the Pi settings directory", error))?;
    let mut settings = serde_json::Map::new();
    settings.insert("defaultProvider".to_owned(), json!(provider));
    settings.insert("enableInstallTelemetry".to_owned(), json!(false));
    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        settings.insert("defaultModel".to_owned(), json!(model));
    }
    os.write_file(PI_SETTINGS_PATH, Value::Object(settings).to_string())
        .await
        .map_err(|error| safe_client_error("Could not write the Pi settings", error))
}

fn configured_providers() -> Vec<Provider> {
    PROVIDERS
        .iter()
        .filter(|provider| {
            std::env::var(provider.env_name)
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
        })
        .cloned()
        .collect()
}

fn select_provider(requested: Option<&str>) -> Result<Provider, String> {
    let configured = configured_providers();
    match requested.filter(|value| !value.trim().is_empty()) {
        Some(id) => PROVIDERS
            .iter()
            .find(|provider| provider.id == id)
            .cloned()
            .ok_or_else(|| format!("Halo does not know the model provider '{id}'.")),
        None => configured
            .into_iter()
            .next()
            .ok_or_else(missing_credential_error),
    }
}

fn missing_credential_error() -> String {
    "No model credential is set. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in the environment that starts Halo. Workspace files still work without one.".to_owned()
}

fn validate_workspace_path(path: &str) -> Result<String, String> {
    let path = Path::new(path);
    if !path.is_absolute() || !path.starts_with(WORKSPACE_ROOT) {
        return Err(format!("The path must stay inside {WORKSPACE_ROOT}."));
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("The path cannot contain '..'.".to_owned());
    }
    Ok(path.to_string_lossy().into_owned())
}

fn validate_session_id(session_id: &str) -> Result<(), String> {
    if session_id.is_empty()
        || session_id.len() > 128
        || !session_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("Session IDs may contain letters, numbers, '-' and '_' only.".to_owned());
    }
    Ok(())
}

fn session_summary(session: agentos_client::SessionInfo) -> SessionSummary {
    let state = match session.state {
        agentos_client::SessionState::Idle => "idle",
        agentos_client::SessionState::Running { .. } => "running",
        agentos_client::SessionState::Waiting { .. } => "waiting",
        agentos_client::SessionState::Failed { .. } => "failed",
    };
    SessionSummary {
        session_id: session.session_id,
        agent: session.agent,
        cwd: session.cwd,
        state: state.to_owned(),
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
    }
}

fn collect_text(value: &Value) -> String {
    let mut text = Vec::new();
    collect_text_parts(value, &mut text);
    text.join("")
}

fn collect_text_parts(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::Array(values) => {
            for value in values {
                collect_text_parts(value, output);
            }
        }
        Value::Object(object) => {
            if object.get("type").and_then(Value::as_str) == Some("text") {
                if let Some(text) = object.get("text").and_then(Value::as_str) {
                    output.push(text.to_owned());
                    return;
                }
            }
            for value in object.values() {
                collect_text_parts(value, output);
            }
        }
        _ => {}
    }
}

fn safe_client_error(context: &str, error: impl std::fmt::Display) -> String {
    let mut message = error.to_string();
    for provider in PROVIDERS {
        if let Ok(secret) = std::env::var(provider.env_name) {
            if !secret.is_empty() {
                message = message.replace(&secret, "[redacted]");
            }
        }
    }
    return format!("{context}: {message}");
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

    use super::{
        collect_text, validate_session_id, validate_workspace_path, AgentOsService, StartupConfig,
        WorkspaceLayout, WORKSPACE_ROOT,
    };
    use agentos_client::OpenSessionInput;
    use serde_json::json;

    static SIDECAR_TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    #[test]
    fn workspace_layout_accepts_safe_usernames() {
        let layout = WorkspaceLayout::new("test-user_1").expect("valid workspace layout");
        assert_eq!(layout.root, "/halo/test-user_1");
        assert_eq!(layout.files, "/halo/test-user_1/files");
        assert_eq!(layout.pi_config_dir, "/halo/test-user_1/files/.pi/agent");
        assert_eq!(
            layout.pi_settings_path,
            "/halo/test-user_1/files/.pi/agent/settings.json"
        );
    }

    #[test]
    fn workspace_layout_rejects_unsafe_usernames() {
        for username in [
            "",
            "..",
            "user/name",
            "user\\name",
            "café",
            "a-username-that-is-longer-than-sixty-four-characters-and-must-be-rejected",
        ] {
            assert!(
                WorkspaceLayout::new(username).is_err(),
                "accepted unsafe username: {username}"
            );
        }
    }

    #[tokio::test]
    async fn workspace_commands_require_start() {
        let data_dir =
            std::env::temp_dir().join(format!("halo-agentos-idle-test-{}", uuid::Uuid::new_v4()));
        let service = AgentOsService::new(&data_dir);

        assert_eq!(
            service
                .write_file("/home/agentos/test.txt", "test")
                .await
                .expect_err("write should require startup"),
            "Start a workspace first."
        );
        assert_eq!(
            service
                .read_file("/home/agentos/test.txt")
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

    #[test]
    fn workspace_paths_stay_in_workspace() {
        assert!(validate_workspace_path("/home/agentos/hello.txt").is_ok());
        assert!(validate_workspace_path("/tmp/hello.txt").is_err());
        assert!(validate_workspace_path("/home/agentos/../secret").is_err());
    }

    #[test]
    fn session_ids_are_safe() {
        assert!(validate_session_id("session-1_test").is_ok());
        assert!(validate_session_id("session/one").is_err());
    }

    #[test]
    fn extracts_text_from_acp_message() {
        let message = json!({
            "content": [
                { "type": "text", "text": "Hello" },
                { "type": "text", "text": " world" }
            ]
        });
        assert_eq!(collect_text(&message), "Hello world");
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
        service
            .write_file("/home/agentos/persistent.txt", "still here")
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
        assert_eq!(
            restarted
                .read_file("/home/agentos/persistent.txt")
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
        env.insert("HOME".to_owned(), WORKSPACE_ROOT.to_owned());
        env.insert("OPENAI_API_KEY".to_owned(), "test-key-not-real".to_owned());
        env.insert("PI_SKIP_VERSION_CHECK".to_owned(), "1".to_owned());
        env.insert("PI_TELEMETRY".to_owned(), "0".to_owned());
        service
            .ready()
            .await
            .expect("ready AgentOS")
            .open_session(OpenSessionInput {
                session_id: Some("restart-test".to_owned()),
                agent: "pi".to_owned(),
                cwd: Some(WORKSPACE_ROOT.to_owned()),
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
        assert!(sessions
            .iter()
            .any(|session| session.session_id == "restart-test"));
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
