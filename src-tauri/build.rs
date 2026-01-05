use std::process::Command;
use std::env;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

    if target_os == "macos" {
        println!("cargo:rerun-if-changed=../sidecar/parakeet-swift/Sources/main.swift");
        println!("cargo:rerun-if-changed=../sidecar/parakeet-swift/Package.swift");
        println!("cargo:rerun-if-changed=../sidecar/parakeet-swift/build.sh");

        // Build target triple for the sidecar build script
        let target_triple = format!("{}-apple-darwin", target_arch);
        
        println!("cargo:warning=🚀 Building Parakeet Swift sidecar for {}...", target_triple);
        
        let status = Command::new("bash")
            .arg("../sidecar/parakeet-swift/build.sh")
            .env("TAURI_ENV_TARGET_TRIPLE", &target_triple)
            .status()
            .expect("Failed to run sidecar build script");

        if !status.success() {
            panic!("Sidecar build script failed with status: {}", status);
        }
    }

    tauri_build::build()
}
