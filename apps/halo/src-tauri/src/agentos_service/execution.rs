use std::sync::{Arc, Weak};

use agentos_client::language_execution::{
    ExecutionOutputOptions, OutputCapture, TypeScriptExecutionOptions,
};
use agentos_client::{
    AgentOs, Binding, Bindings, InlineExecutionOptions, LanguageExecutionOptions,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::RwLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecBindingInput {
    source: String,
    cwd: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecBindingOutput {
    value: Option<Value>,
    execution: Value,
}

#[derive(Clone)]
pub(super) struct ExecutionBridge {
    os: Arc<RwLock<Option<AgentOs>>>,
}

impl ExecutionBridge {
    pub(super) fn new() -> Self {
        Self {
            os: Arc::new(RwLock::new(None)),
        }
    }

    pub(super) fn bindings(&self) -> Vec<Bindings> {
        let os = Arc::downgrade(&self.os);
        vec![Bindings {
            name: "halo".to_owned(),
            description: "Halo execution tools.".to_owned(),
            bindings: vec![Binding {
                name: "exec".to_owned(),
                description: "Evaluate TypeScript in the current AgentOS VM.".to_owned(),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "source": { "type": "string" },
                        "cwd": { "type": "string" }
                    },
                    "required": ["source", "cwd"],
                    "additionalProperties": false
                }),
                timeout_ms: None,
                execute: Arc::new(move |input| {
                    let os = os.clone();
                    Box::pin(async move { execute(os, input).await })
                }),
            }],
        }]
    }

    pub(super) async fn attach(&self, os: AgentOs) {
        *self.os.write().await = Some(os);
    }

    pub(super) async fn detach(&self) {
        *self.os.write().await = None;
    }
}

async fn execute(os: Weak<RwLock<Option<AgentOs>>>, input: Value) -> Result<Value, String> {
    let input: ExecBindingInput =
        serde_json::from_value(input).map_err(|error| format!("Invalid exec input: {error}"))?;
    let os = os
        .upgrade()
        .ok_or_else(|| "Halo execution bridge is unavailable.".to_owned())?
        .read()
        .await
        .clone()
        .ok_or_else(|| "Halo execution bridge is not ready.".to_owned())?;
    let expression = format!("(async () => {{ {} }})()", input.source);
    let evaluation = os
        .evaluate_typescript(
            expression,
            TypeScriptExecutionOptions {
                inline: InlineExecutionOptions {
                    process: LanguageExecutionOptions {
                        cwd: Some(input.cwd),
                        output: ExecutionOutputOptions {
                            capture: OutputCapture::All,
                            retain_events: false,
                        },
                        ..Default::default()
                    },
                    ..Default::default()
                },
                ..Default::default()
            },
        )
        .await
        .map_err(|error| format!("AgentOS TypeScript evaluation failed: {error}"))?;
    if let Some(error) = &evaluation.result.error {
        // AgentOS reports thrown JavaScript as a generic exit error; V8 writes the cause to stderr.
        let stderr = evaluation
            .result
            .stderr
            .as_deref()
            .map(String::from_utf8_lossy)
            .map(|stderr| stderr.trim().to_owned())
            .filter(|stderr| !stderr.is_empty())
            .unwrap_or_else(|| error.message.clone());
        return Err(format!("AgentOS TypeScript evaluation failed: {stderr}"));
    }
    let output = ExecBindingOutput {
        value: evaluation.value,
        execution: serde_json::to_value(evaluation.result)
            .map_err(|error| format!("Could not serialize execution result: {error}"))?,
    };
    serde_json::to_value(output)
        .map_err(|error| format!("Could not serialize exec output: {error}"))
}
