use std::path::{Component, Path};

use agentos_client::{
    AgentOs, InlineExecutionOptions, JavaScriptExecutionOptions, JavaScriptModuleFormat,
    LanguageExecutionOptions, MkdirOptions, RemoveOptions,
};
use serde::Serialize;

use super::providers::safe_client_error;
use super::ReadyWorkspace;

const MAX_OWNER_SLUG_LENGTH: usize = 64;
pub(super) const VM_USER_ID: u32 = 1000;
const VM_HOME_STAGING_DIR: &str = "/tmp";
const CODE_MODE_TOOLS: &str = include_str!("../../agentos/halo-tools.mjs");

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceLayout {
    pub(super) root: String,
    pi_config_dir: String,
    pub(super) pi_settings_path: String,
    pub(super) tools_module_path: String,
}

impl WorkspaceLayout {
    pub fn new(owner_slug: &str) -> Result<Self, String> {
        if owner_slug.is_empty()
            || owner_slug.len() > MAX_OWNER_SLUG_LENGTH
            || !owner_slug.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
            })
        {
            return Err(format!(
                "Usernames must be 1 to {MAX_OWNER_SLUG_LENGTH} ASCII letters, numbers, '-' or '_' only."
            ));
        }

        let root = format!("/halo/{owner_slug}");
        let pi_config_dir = format!("{root}/.pi/agent");
        let pi_settings_path = format!("{pi_config_dir}/settings.json");
        let tools_module_path = format!("{root}/tools/index.mjs");
        Ok(Self {
            root,
            pi_config_dir,
            pi_settings_path,
            tools_module_path,
        })
    }
}

pub(super) async fn install_code_mode_tools(
    os: &AgentOs,
    layout: &WorkspaceLayout,
) -> Result<(), String> {
    write_text_file_as_vm_user(
        os,
        &layout.root,
        &layout.tools_module_path,
        CODE_MODE_TOOLS,
        "Could not install the code-mode tools",
    )
    .await
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub is_symbolic_link: bool,
}

impl ReadyWorkspace {
    pub(super) async fn write_file(&self, path: &str, content: &str) -> Result<(), String> {
        let path = validate_workspace_path(path, &self.layout.root)?;
        write_text_file_as_vm_user(
            &self.os,
            &self.layout.root,
            &path,
            content,
            "Could not write the file",
        )
        .await
    }

    pub(super) async fn read_file(&self, path: &str) -> Result<String, String> {
        let path = validate_workspace_path(path, &self.layout.root)?;
        let bytes = self
            .os
            .read_file(&path)
            .await
            .map_err(|error| safe_client_error("Could not read the file", error))?;
        String::from_utf8(bytes).map_err(|_| "The file is not valid UTF-8 text.".to_owned())
    }

    pub(super) async fn list_files(
        &self,
        path: Option<&str>,
    ) -> Result<Vec<WorkspaceEntry>, String> {
        let path = validate_workspace_path(path.unwrap_or(&self.layout.root), &self.layout.root)?;
        let mut entries = self
            .os
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
}

pub(super) async fn ensure_workspace_home(
    os: &AgentOs,
    layout: &WorkspaceLayout,
) -> Result<(), String> {
    if os
        .exists(&layout.root)
        .await
        .map_err(|error| safe_client_error("Could not inspect the workspace home", error))?
    {
        return verify_workspace_home(os, &layout.root).await;
    }

    os.mkdir("/halo", MkdirOptions { recursive: true })
        .await
        .map_err(|error| safe_client_error("Could not create /halo", error))?;

    // AgentOS file calls create directories as root, and this client version has no public chown.
    // Create the home as the VM user under /tmp, then move it without changing ownership.
    let staging_path = format!("{VM_HOME_STAGING_DIR}/.halo-home-{}", uuid::Uuid::new_v4());
    let source = format!(
        "require('fs').mkdirSync({}, {{ mode: 0o700 }});",
        serde_json::to_string(&staging_path).expect("staging path is valid JSON")
    );
    let result = os
        .execute_javascript(source, vm_user_javascript_options(VM_HOME_STAGING_DIR))
        .await
        .map_err(|error| safe_client_error("Could not stage the workspace home", error))?;
    if result.exit_code != Some(0) {
        let _ = os
            .remove(&staging_path, RemoveOptions { recursive: true })
            .await;
        return Err("Could not stage a writable workspace home.".to_owned());
    }

    if let Err(error) = os.move_path(&staging_path, &layout.root).await {
        let _ = os
            .remove(&staging_path, RemoveOptions { recursive: true })
            .await;
        return Err(safe_client_error(
            "Could not install the workspace home",
            error,
        ));
    }
    verify_workspace_home(os, &layout.root).await
}

async fn verify_workspace_home(os: &AgentOs, path: &str) -> Result<(), String> {
    let stat = os
        .stat(path)
        .await
        .map_err(|error| safe_client_error("Could not inspect the workspace home", error))?;
    if !stat.is_directory
        || stat.uid != VM_USER_ID
        || stat.gid != VM_USER_ID
        || stat.mode & 0o200 == 0
    {
        return Err(format!(
            "The workspace home at {path} must be a directory owned by the AgentOS user."
        ));
    }
    Ok(())
}

pub(super) async fn write_text_file_as_vm_user(
    os: &AgentOs,
    workspace_root: &str,
    path: &str,
    content: &str,
    error_context: &str,
) -> Result<(), String> {
    let source = format!(
        "const fs = require('fs'); fs.mkdirSync({}, {{ recursive: true, mode: 0o700 }}); fs.writeFileSync({}, {}, {{ encoding: 'utf8', mode: 0o600 }});",
        serde_json::to_string(
            Path::new(path)
                .parent()
                .and_then(Path::to_str)
                .expect("validated workspace file has a parent")
        )
        .expect("workspace parent path is valid JSON"),
        serde_json::to_string(path).expect("workspace path is valid JSON"),
        serde_json::to_string(content).expect("workspace content is valid JSON"),
    );
    let result = os
        .execute_javascript(source, vm_user_javascript_options(workspace_root))
        .await
        .map_err(|error| safe_client_error(error_context, error))?;
    if result.exit_code != Some(0) {
        return Err(format!("{error_context}: AgentOS returned a failed write."));
    }
    Ok(())
}

fn vm_user_javascript_options(cwd: &str) -> JavaScriptExecutionOptions {
    JavaScriptExecutionOptions {
        inline: InlineExecutionOptions {
            process: LanguageExecutionOptions {
                cwd: Some(cwd.to_owned()),
                ..Default::default()
            },
            ..Default::default()
        },
        format: JavaScriptModuleFormat::CommonJs,
        ..Default::default()
    }
}

fn validate_workspace_path(path: &str, workspace_root: &str) -> Result<String, String> {
    let path = Path::new(path);
    if !path.is_absolute() || !path.starts_with(workspace_root) {
        return Err(format!("The path must stay inside {workspace_root}."));
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("The path cannot contain '..'.".to_owned());
    }
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::{validate_workspace_path, WorkspaceLayout};

    #[test]
    fn workspace_layout_accepts_safe_owner_slugs() {
        let layout = WorkspaceLayout::new("test-user_1").expect("valid workspace layout");
        assert_eq!(layout.root, "/halo/test-user_1");
        assert_eq!(layout.pi_config_dir, "/halo/test-user_1/.pi/agent");
        assert_eq!(
            layout.pi_settings_path,
            "/halo/test-user_1/.pi/agent/settings.json"
        );
        assert_eq!(
            layout.tools_module_path,
            "/halo/test-user_1/tools/index.mjs"
        );
    }

    #[test]
    fn workspace_layout_rejects_unsafe_owner_slugs() {
        for owner_slug in [
            "",
            "..",
            "user/name",
            "user\\name",
            "café",
            "an-owner-slug-that-is-longer-than-sixty-four-characters-and-is-rejected",
        ] {
            assert!(
                WorkspaceLayout::new(owner_slug).is_err(),
                "accepted unsafe owner slug: {owner_slug}"
            );
        }
    }

    #[test]
    fn workspace_paths_stay_in_workspace() {
        let root = "/halo/test-user";
        assert!(validate_workspace_path("/halo/test-user/hello.txt", root).is_ok());
        assert!(validate_workspace_path("/halo/test-user", root).is_ok());
        assert!(validate_workspace_path("/halo/test-user-two/hello.txt", root).is_err());
        assert!(validate_workspace_path("/tmp/hello.txt", root).is_err());
        assert!(validate_workspace_path("/halo/test-user/../secret", root).is_err());
    }
}
