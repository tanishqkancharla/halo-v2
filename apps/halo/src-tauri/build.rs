use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    stage_sidecar();
    tauri_build::build();
}

fn stage_sidecar() {
    let target = env::var("TARGET").expect("Cargo did not set TARGET");
    println!("cargo:rustc-env=HALO_TARGET={target}");
    let source = env::var_os("AGENTOS_SIDECAR_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| npm_sidecar_path(&target));
    let destination_dir = Path::new("binaries");
    let destination = destination_dir.join(format!("agentos-sidecar-{target}"));

    println!("cargo:rerun-if-env-changed=AGENTOS_SIDECAR_BIN");
    println!("cargo:rerun-if-changed={}", source.display());

    if !source.is_file() {
        panic!(
            "AgentOS sidecar not found at {}. Run pnpm install first.",
            source.display()
        );
    }

    fs::create_dir_all(destination_dir).expect("create sidecar staging directory");
    fs::copy(&source, &destination).expect("stage AgentOS sidecar");
}

fn npm_sidecar_path(target: &str) -> PathBuf {
    let package = if target.contains("apple-darwin") && target.starts_with("aarch64") {
        "agentos-sidecar-darwin-arm64"
    } else if target.contains("apple-darwin") && target.starts_with("x86_64") {
        "agentos-sidecar-darwin-x64"
    } else if target.contains("linux-gnu") && target.starts_with("aarch64") {
        "agentos-sidecar-linux-arm64-gnu"
    } else if target.contains("linux-gnu") && target.starts_with("x86_64") {
        "agentos-sidecar-linux-x64-gnu"
    } else {
        panic!("AgentOS has no prebuilt sidecar for target {target}");
    };

    let resolver = Path::new("../node_modules/@rivet-dev/agentos-sidecar")
        .canonicalize()
        .expect("resolve @rivet-dev/agentos-sidecar; run pnpm install first");
    resolver
        .parent()
        .expect("sidecar package has a parent directory")
        .join(package)
        .join("agentos-sidecar")
}
