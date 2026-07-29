mod agentos_service;

use std::path::PathBuf;
use std::sync::Arc;

use agentos_service::{
    AgentOsService, HealthStatus, PromptResponse, SessionSummary, StartupConfig, WorkspaceEntry,
    WorkspaceLayout,
};
use serde_json::Value;
use tauri::{Manager, RunEvent, State};

struct HaloState {
    agentos: Arc<AgentOsService>,
    startup: StartupConfig,
}

#[tauri::command]
async fn start_workspace(
    state: State<'_, HaloState>,
    owner_slug: String,
) -> Result<HealthStatus, String> {
    let layout = WorkspaceLayout::new(&owner_slug)?;
    state
        .agentos
        .initialize(layout, state.startup.clone())
        .await?;
    Ok(state.agentos.health().await)
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
async fn read_session_history(
    state: State<'_, HaloState>,
    session_id: String,
) -> Result<Vec<Value>, String> {
    state.agentos.read_history(&session_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_development_env().expect("could not load Halo's development environment");

    let app = tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("Could not find the app data directory: {error}"))?;
            let service = Arc::new(AgentOsService::new(&app_data_dir));
            let startup = StartupConfig {
                app_data_dir,
                sidecar_path: find_sidecar_path(app.handle())?,
                pi_package_path: find_pi_package_path(app.handle())?,
            };
            app.manage(HaloState {
                agentos: service,
                startup,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_workspace,
            sidecar_health,
            write_workspace_file,
            read_workspace_file,
            list_workspace_files,
            create_or_reopen_session,
            send_prompt,
            list_sessions,
            read_session_history,
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

#[cfg(not(debug_assertions))]
fn load_development_env() -> Result<(), String> {
    Ok(())
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
