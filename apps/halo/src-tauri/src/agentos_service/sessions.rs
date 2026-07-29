use std::collections::BTreeMap;

use agentos_client::{ListSessionsInput, OpenSessionInput, PromptInput, ReadHistoryInput};
use serde::Serialize;
use serde_json::{json, Value};

use super::providers::{
    configured_providers, missing_credential_error, safe_client_error, select_provider,
    write_pi_settings,
};
use super::ReadyWorkspace;

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

impl ReadyWorkspace {
    pub(super) async fn create_or_reopen_session(
        &self,
        session_id: Option<String>,
        provider_id: Option<String>,
        model: Option<String>,
    ) -> Result<SessionSummary, String> {
        let session_id = session_id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("session-{}", uuid::Uuid::new_v4()));
        validate_session_id(&session_id)?;

        if let Ok(existing) = self.os.get_session(Some(&session_id)).await {
            return Ok(session_summary(existing));
        }

        let provider = select_provider(provider_id.as_deref())?;
        let key = std::env::var(provider.env_name)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(missing_credential_error)?;

        write_pi_settings(&self.os, &self.layout, provider.id, model.as_deref()).await?;

        let mut env = BTreeMap::new();
        env.insert("HOME".to_owned(), self.layout.root.clone());
        env.insert(provider.env_name.to_owned(), key);
        env.insert("PI_SKIP_VERSION_CHECK".to_owned(), "1".to_owned());
        env.insert("PI_TELEMETRY".to_owned(), "0".to_owned());

        self.os
            .open_session(OpenSessionInput {
                session_id: Some(session_id.clone()),
                agent: "pi".to_owned(),
                cwd: Some(self.layout.root.clone()),
                additional_directories: None,
                env: Some(env),
                mcp_servers: None,
                permission_policy: None,
                skip_os_instructions: None,
                additional_instructions: None,
            })
            .await
            .map_err(|error| safe_client_error("Could not open the Pi session", error))?;

        let session = self
            .os
            .get_session(Some(&session_id))
            .await
            .map_err(|error| safe_client_error("Could not read the new session", error))?;
        Ok(session_summary(session))
    }

    pub(super) async fn send_prompt(
        &self,
        session_id: &str,
        prompt: &str,
    ) -> Result<PromptResponse, String> {
        validate_session_id(session_id)?;
        if prompt.trim().is_empty() {
            return Err("Enter a prompt first.".to_owned());
        }
        if configured_providers().is_empty() {
            return Err(missing_credential_error());
        }

        let content = serde_json::from_value(json!({ "type": "text", "text": prompt }))
            .map_err(|error| format!("Could not build the prompt: {error}"))?;
        let result = self
            .os
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

    pub(super) async fn list_sessions(&self) -> Result<Vec<SessionSummary>, String> {
        let page = self
            .os
            .list_sessions(ListSessionsInput {
                cursor: None,
                limit: Some(200),
            })
            .await
            .map_err(|error| safe_client_error("Could not list sessions", error))?;
        Ok(page.sessions.into_iter().map(session_summary).collect())
    }

    pub(super) async fn read_history(&self, session_id: &str) -> Result<Vec<Value>, String> {
        validate_session_id(session_id)?;
        let page = self
            .os
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{collect_text, validate_session_id};

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
}
