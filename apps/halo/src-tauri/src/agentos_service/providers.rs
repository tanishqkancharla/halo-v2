use agentos_client::AgentOs;
use serde_json::{json, Value};

use super::workspace::{write_text_file_as_vm_user, WorkspaceLayout};

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
pub(super) struct Provider {
    pub(super) id: &'static str,
    pub(super) env_name: &'static str,
}

pub(super) async fn write_pi_settings(
    os: &AgentOs,
    layout: &WorkspaceLayout,
    provider: &str,
    model: Option<&str>,
) -> Result<(), String> {
    let mut settings = serde_json::Map::new();
    settings.insert("defaultProvider".to_owned(), json!(provider));
    settings.insert("enableInstallTelemetry".to_owned(), json!(false));
    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        settings.insert("defaultModel".to_owned(), json!(model));
    }
    write_text_file_as_vm_user(
        os,
        &layout.root,
        &layout.pi_settings_path,
        &Value::Object(settings).to_string(),
        "Could not write the Pi settings",
    )
    .await
}

pub(super) fn configured_providers() -> Vec<Provider> {
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

pub(super) fn select_provider(requested: Option<&str>) -> Result<Provider, String> {
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

pub(super) fn missing_credential_error() -> String {
    "No model credential is set. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in the environment that starts Halo. Workspace files still work without one.".to_owned()
}

pub(super) fn safe_client_error(context: &str, error: impl std::fmt::Display) -> String {
    let mut message = error.to_string();
    for provider in PROVIDERS {
        if let Ok(secret) = std::env::var(provider.env_name) {
            if !secret.is_empty() {
                message = message.replace(&secret, "[redacted]");
            }
        }
    }
    format!("{context}: {message}")
}
