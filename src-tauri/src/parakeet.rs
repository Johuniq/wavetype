use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Emitter, State};
use log::{info, error, debug};

#[derive(Debug, Serialize, Deserialize)]
pub struct ParakeetCommand {
    #[serde(rename = "type")]
    pub command_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub force_download: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParakeetResponse {
    #[serde(rename = "type")]
    pub response_type: String,
    pub text: Option<String>,
    pub code: Option<String>,
    pub message: Option<String>,
    pub loaded_model: Option<String>,
    pub model_version: Option<String>,
}

pub struct ParakeetSidecar {
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl ParakeetSidecar {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    #[cfg(target_os = "macos")]
    pub fn start(&self, app: &AppHandle) -> Result<(), String> {
        let mut child_guard = self.child.lock().unwrap();
        if child_guard.is_some() {
            return Ok(());
        }

        info!("Starting Parakeet sidecar...");

        let sidecar = app.shell().sidecar("parakeet-sidecar")
            .map_err(|e| format!("Failed to create sidecar: {}", e))?;

        let (mut rx, child) = sidecar.spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        let line_str = String::from_utf8_lossy(&line);
                        debug!("Parakeet Sidecar Stdout: {}", line_str);
                        if let Ok(response) = serde_json::from_str::<ParakeetResponse>(&line_str) {
                            let _ = app_handle.emit("parakeet-response", response);
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        let line_str = String::from_utf8_lossy(&line);
                        info!("Parakeet Sidecar Stderr: {}", line_str);
                    }
                    CommandEvent::Error(e) => {
                        error!("Parakeet Sidecar Error: {}", e);
                    }
                    CommandEvent::Terminated(payload) => {
                        info!("Parakeet Sidecar Terminated: {:?}", payload);
                        // Handle restart if needed
                    }
                    _ => {}
                }
            }
        });

        *child_guard = Some(child);
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    pub fn start(&self, _app: &AppHandle) -> Result<(), String> {
        Err("Parakeet is only available on macOS. Please use Whisper models on Linux/Windows.".to_string())
    }

    #[cfg(target_os = "macos")]
    pub fn send_command(&self, command: ParakeetCommand) -> Result<(), String> {
        let mut child_guard = self.child.lock().unwrap();
        if let Some(ref mut child) = *child_guard {
            let json = serde_json::to_string(&command).map_err(|e| e.to_string())?;
            child.write(format!("{}\n", json).as_bytes()).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Sidecar not started".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn send_command(&self, _command: ParakeetCommand) -> Result<(), String> {
        Err("Parakeet is only available on macOS. Please use Whisper models on Linux/Windows.".to_string())
    }
}

pub struct ParakeetState(pub Arc<ParakeetSidecar>);

#[tauri::command]
pub async fn start_parakeet(app: AppHandle, state: State<'_, ParakeetState>) -> Result<(), String> {
    state.0.start(&app)
}

#[tauri::command]
pub async fn send_parakeet_command(state: State<'_, ParakeetState>, command: ParakeetCommand) -> Result<(), String> {
    state.0.send_command(command)
}
