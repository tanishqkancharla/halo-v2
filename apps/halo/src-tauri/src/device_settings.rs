use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::agentos_service::WorkspaceLayout;

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceSettings {
    last_owner_slug: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StartupPreference {
    pub(crate) last_owner_slug: Option<String>,
}

pub(crate) fn load_startup_preference(path: &Path) -> StartupPreference {
    let last_owner_slug = fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<DeviceSettings>(&bytes).ok())
        .and_then(|settings| settings.last_owner_slug)
        .filter(|owner_slug| WorkspaceLayout::new(owner_slug).is_ok());

    StartupPreference { last_owner_slug }
}

pub(crate) fn save_last_owner_slug(path: &Path, owner_slug: &str) -> Result<(), String> {
    WorkspaceLayout::new(owner_slug)?;

    let parent = path
        .parent()
        .ok_or_else(|| "The device settings path has no parent directory.".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create the device settings directory: {error}"))?;

    let settings = DeviceSettings {
        last_owner_slug: Some(owner_slug.to_owned()),
    };
    let mut bytes = serde_json::to_vec_pretty(&settings)
        .map_err(|error| format!("Could not encode the device settings: {error}"))?;
    bytes.push(b'\n');

    let temporary_path = temporary_path(path)?;
    let result = write_and_replace(path, &temporary_path, &bytes);
    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

fn temporary_path(path: &Path) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The device settings path has no parent directory.".to_owned())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The device settings path has no valid file name.".to_owned())?;
    Ok(parent.join(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4())))
}

fn write_and_replace(path: &Path, temporary_path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    let mut file = options
        .open(temporary_path)
        .map_err(|error| format!("Could not create the temporary device settings file: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("Could not write the device settings: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Could not sync the device settings: {error}"))?;
    drop(file);

    fs::rename(temporary_path, path)
        .map_err(|error| format!("Could not replace the device settings: {error}"))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::{load_startup_preference, save_last_owner_slug};

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "halo-device-settings-{name}-{}",
            uuid::Uuid::new_v4()
        ))
    }

    #[test]
    fn missing_settings_have_no_preference() {
        let path = test_directory("missing").join("device-settings.json");
        assert_eq!(load_startup_preference(&path).last_owner_slug, None);
    }

    #[test]
    fn saves_and_loads_a_valid_owner_slug() {
        let directory = test_directory("valid");
        let path = directory.join("device-settings.json");

        save_last_owner_slug(&path, "test-owner").expect("save device settings");

        assert_eq!(
            load_startup_preference(&path).last_owner_slug.as_deref(),
            Some("test-owner")
        );
        fs::remove_dir_all(directory).expect("remove device settings test directory");
    }

    #[test]
    fn corrupt_or_invalid_settings_have_no_preference() {
        let directory = test_directory("invalid");
        fs::create_dir_all(&directory).expect("create device settings test directory");
        let path = directory.join("device-settings.json");

        fs::write(&path, b"not json").expect("write corrupt settings");
        assert_eq!(load_startup_preference(&path).last_owner_slug, None);

        fs::write(&path, br#"{"lastOwnerSlug":"../unsafe"}"#).expect("write invalid settings");
        assert_eq!(load_startup_preference(&path).last_owner_slug, None);
        fs::remove_dir_all(directory).expect("remove device settings test directory");
    }

    #[test]
    fn atomically_replaces_existing_settings() {
        let directory = test_directory("replace");
        let path = directory.join("device-settings.json");
        save_last_owner_slug(&path, "first-owner").expect("save first preference");

        save_last_owner_slug(&path, "second-owner").expect("replace preference");

        assert_eq!(
            load_startup_preference(&path).last_owner_slug.as_deref(),
            Some("second-owner")
        );
        let files = fs::read_dir(&directory)
            .expect("read device settings directory")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect device settings files");
        assert_eq!(files.len(), 1);
        fs::remove_dir_all(directory).expect("remove device settings test directory");
    }
}
