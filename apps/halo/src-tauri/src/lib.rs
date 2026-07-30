mod agentos_service;
mod device_settings;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use agentos_service::{
    AgentOsService, HealthStatus, PromptResponse, SessionSummary, SessionTranscript, StartupConfig,
    WorkspaceEntry, WorkspaceLayout,
};
use device_settings::{load_startup_preference, save_last_owner_slug, StartupPreference};
use serde::Serialize;
#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItemBuilder};
use tauri::{Manager, RunEvent, State};

#[cfg(target_os = "macos")]
const RELOAD_MENU_ID: &str = "reload";

struct HaloState {
    agentos: Arc<AgentOsService>,
    startup: StartupConfig,
    device_settings_path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartWorkspaceResult {
    health: HealthStatus,
    preference_saved: bool,
    preference_warning: Option<String>,
}

#[tauri::command]
fn get_startup_preference(state: State<'_, HaloState>) -> StartupPreference {
    load_startup_preference(&state.device_settings_path)
}

#[tauri::command]
async fn start_workspace(
    state: State<'_, HaloState>,
    owner_slug: String,
) -> Result<StartWorkspaceResult, String> {
    start_workspace_inner(
        &state.agentos,
        state.startup.clone(),
        &state.device_settings_path,
        &owner_slug,
    )
    .await
}

async fn start_workspace_inner(
    agentos: &AgentOsService,
    startup: StartupConfig,
    device_settings_path: &Path,
    owner_slug: &str,
) -> Result<StartWorkspaceResult, String> {
    let layout = WorkspaceLayout::new(owner_slug)?;
    agentos.initialize(layout, startup).await?;
    let health = agentos.health().await;
    Ok(finish_workspace_start(
        health,
        device_settings_path,
        owner_slug,
    ))
}

fn finish_workspace_start(
    health: HealthStatus,
    device_settings_path: &Path,
    owner_slug: &str,
) -> StartWorkspaceResult {
    let preference_warning = save_last_owner_slug(device_settings_path, owner_slug).err();
    StartWorkspaceResult {
        health,
        preference_saved: preference_warning.is_none(),
        preference_warning,
    }
}

#[tauri::command]
async fn sidecar_health(state: State<'_, HaloState>) -> Result<HealthStatus, String> {
    Ok(state.agentos.health().await)
}

#[tauri::command]
async fn write_workspace_file(
    state: State<'_, HaloState>,
    path: String,
    content: String,
) -> Result<(), String> {
    state.agentos.write_file(&path, &content).await
}

#[tauri::command]
async fn read_workspace_file(state: State<'_, HaloState>, path: String) -> Result<String, String> {
    state.agentos.read_file(&path).await
}

#[tauri::command]
async fn list_workspace_files(
    state: State<'_, HaloState>,
    path: Option<String>,
) -> Result<Vec<WorkspaceEntry>, String> {
    state.agentos.list_files(path.as_deref()).await
}

#[tauri::command]
async fn create_or_reopen_session(
    state: State<'_, HaloState>,
    session_id: Option<String>,
    provider: Option<String>,
    model: Option<String>,
) -> Result<SessionSummary, String> {
    state
        .agentos
        .create_or_reopen_session(session_id, provider, model)
        .await
}

#[tauri::command]
async fn send_prompt(
    state: State<'_, HaloState>,
    session_id: String,
    prompt: String,
) -> Result<PromptResponse, String> {
    state.agentos.send_prompt(&session_id, &prompt).await
}

#[tauri::command]
async fn list_sessions(state: State<'_, HaloState>) -> Result<Vec<SessionSummary>, String> {
    state.agentos.list_sessions().await
}

#[tauri::command]
async fn read_session_transcript(
    state: State<'_, HaloState>,
    session_id: String,
) -> Result<SessionTranscript, String> {
    state.agentos.read_transcript(&session_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_development_env().expect("could not load Halo's development environment");

    let builder = tauri::Builder::default();
    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(|app| {
            let menu = Menu::default(app)?;
            let reload = MenuItemBuilder::with_id(RELOAD_MENU_ID, "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            // Tauri's macOS default menu orders App, File, Edit, View, Window, Help.
            let default_items = menu.items()?;
            let view_menu = default_items[3].as_submenu_unchecked();
            view_menu.insert(&reload, 0)?;
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == RELOAD_MENU_ID {
                app.get_webview_window("main")
                    .expect("main webview window")
                    .reload()
                    .expect("reload main webview");
            }
        });

    let app = builder
        .setup(|app| {
            let default_app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("Could not find the app data directory: {error}"))?;
            let app_data_dir = resolve_app_data_dir(default_app_data_dir);
            let device_settings_path = app_data_dir.join("device-settings.json");
            let service = Arc::new(AgentOsService::new(&app_data_dir));
            let startup = StartupConfig {
                app_data_dir,
                sidecar_path: find_sidecar_path(app.handle())?,
                pi_package_path: find_pi_package_path(app.handle())?,
            };
            app.manage(HaloState {
                agentos: service,
                startup,
                device_settings_path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_startup_preference,
            start_workspace,
            sidecar_health,
            write_workspace_file,
            read_workspace_file,
            list_workspace_files,
            create_or_reopen_session,
            send_prompt,
            list_sessions,
            read_session_transcript,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Halo");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            let service = app_handle.state::<HaloState>().agentos.clone();
            tauri::async_runtime::block_on(service.shutdown());
        }
    });
}

#[cfg(debug_assertions)]
fn load_development_env() -> Result<(), String> {
    let tauri_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        tauri_dir.join("../.env"),
        tauri_dir.join("../../../.env"),
        tauri_dir.join(".env"),
    ];

    if let Some(path) = candidates.into_iter().find(|path| path.is_file()) {
        dotenvy::from_path(&path).map_err(|_| {
            format!(
                "Could not read the development environment file at {}",
                path.display()
            )
        })?;
    }
    Ok(())
}

#[cfg(debug_assertions)]
fn resolve_app_data_dir(default: PathBuf) -> PathBuf {
    let Some(configured) = std::env::var_os("HALO_APP_DATA_DIR").filter(|value| !value.is_empty())
    else {
        return default;
    };

    let configured = PathBuf::from(configured);
    if configured.is_absolute() {
        configured
    } else {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../..")
            .join(configured)
    }
}

#[cfg(not(debug_assertions))]
fn load_development_env() -> Result<(), String> {
    Ok(())
}

#[cfg(not(debug_assertions))]
fn resolve_app_data_dir(default: PathBuf) -> PathBuf {
    default
}

fn find_sidecar_path(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Some(path) = std::env::var_os("AGENTOS_SIDECAR_BIN").map(PathBuf::from) {
        if path.is_file() {
            return Ok(path);
        }
    }

    let resource_dir = app.path().resource_dir()?;
    let executable_name = if cfg!(windows) {
        "agentos-sidecar.exe"
    } else {
        "agentos-sidecar"
    };
    let candidates = [
        resource_dir.join(executable_name),
        resource_dir.join("binaries").join(executable_name),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(format!("agentos-sidecar-{}", env!("HALO_TARGET"))),
    ];
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "The bundled AgentOS sidecar is missing.".into())
}

fn find_pi_package_path(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let resource_path = app.path().resource_dir()?.join("agentos/pi.aospkg");
    let development_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../node_modules/@agentos-software/pi/dist/package.aospkg");
    [resource_path, development_path]
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "The bundled Pi package is missing.".into())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::{
        finish_workspace_start, load_startup_preference, save_last_owner_slug,
        start_workspace_inner, AgentOsService, HealthStatus, StartupConfig,
    };

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "halo-startup-preference-{name}-{}",
            uuid::Uuid::new_v4()
        ))
    }

    fn ready_health() -> HealthStatus {
        HealthStatus {
            status: "ready",
            sidecar_state: Some("ready".to_owned()),
            error: None,
            database_path: "/tmp/agentos.sqlite".to_owned(),
            workspace_root: "/halo/new-owner".to_owned(),
            credential_configured: false,
            credential_providers: Vec::new(),
            credential_storage: "process environment",
        }
    }

    #[tokio::test]
    async fn failed_start_keeps_the_previous_owner_slug() {
        let directory = test_directory("failed-start");
        let settings_path = directory.join("config/device-settings.json");
        let data_dir = directory.join("data");
        save_last_owner_slug(&settings_path, "previous-owner").expect("save old preference");
        let service = AgentOsService::new(&data_dir);

        start_workspace_inner(
            &service,
            StartupConfig {
                app_data_dir: data_dir.clone(),
                sidecar_path: directory.join("missing-sidecar"),
                pi_package_path: directory.join("missing-pi-package"),
            },
            &settings_path,
            "new-owner",
        )
        .await
        .expect_err("missing sidecar should fail startup");

        assert_eq!(
            load_startup_preference(&settings_path)
                .last_owner_slug
                .as_deref(),
            Some("previous-owner")
        );
        fs::remove_dir_all(directory).expect("remove failed-start test directory");
    }

    #[test]
    fn settings_failure_returns_a_warning_without_losing_health() {
        let directory = test_directory("save-warning");
        let settings_path = directory.join("device-settings.json");
        fs::create_dir_all(&settings_path).expect("create blocking settings directory");

        let result = finish_workspace_start(ready_health(), &settings_path, "new-owner");

        assert_eq!(result.health.status, "ready");
        assert!(!result.preference_saved);
        assert!(result.preference_warning.is_some());
        fs::remove_dir_all(directory).expect("remove save-warning test directory");
    }
}
