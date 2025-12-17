mod audio;
mod database;
mod downloader;
mod license;
mod text_inject;
mod transcription;

use audio::AudioRecorder;
use database::{AppSettings, AppState, Database, LicenseData, TranscriptionHistory, WhisperModel};
use downloader::{DownloadProgress, ModelDownloader};
use license::{LicenseClient, LicenseStatus, get_device_label, get_device_meta};
use log::{info, warn, debug};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use transcription::Transcriber;

// Application version from Cargo.toml
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const APP_NAME: &str = env!("CARGO_PKG_NAME");

// Polar Organization ID - REPLACE WITH YOUR ACTUAL ORG ID
const POLAR_ORG_ID: &str = "YOUR_POLAR_ORGANIZATION_ID";

// Rate limiter for preventing abuse
pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            requests: Mutex::new(HashMap::new()),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub fn check(&self, key: &str) -> bool {
        let mut requests = self.requests.lock().unwrap();
        let now = Instant::now();
        
        let timestamps = requests.entry(key.to_string()).or_insert_with(Vec::new);
        
        // Remove old timestamps outside the window
        timestamps.retain(|&t| now.duration_since(t) < self.window);
        
        if timestamps.len() >= self.max_requests {
            warn!("Rate limit exceeded for action: {}", key);
            false
        } else {
            timestamps.push(now);
            true
        }
    }
}

pub struct RateLimiterState(pub Arc<RateLimiter>);

// Input sanitization utilities
fn sanitize_path(path: &str) -> Result<String, String> {
    // Prevent path traversal attacks
    if path.contains("..") || path.contains("//") {
        warn!("Path traversal attempt detected: {}", path);
        return Err("Invalid path: contains forbidden characters".to_string());
    }
    
    // Normalize path separators
    let normalized = path.replace('\\', "/");
    
    // Check for absolute paths outside expected directories
    if normalized.starts_with('/') && !normalized.contains("/WaveType/") && !normalized.contains("/WaveType/") {
        // Allow system temp directories and home directories
        if !normalized.starts_with("/tmp/") && !normalized.starts_with("/home/") && !normalized.starts_with("/Users/") {
            warn!("Access to restricted path attempted: {}", normalized);
            return Err("Invalid path: outside allowed directories".to_string());
        }
    }
    
    Ok(normalized)
}

fn sanitize_text(text: &str, max_len: usize) -> Result<String, String> {
    if text.len() > max_len {
        return Err(format!("Text exceeds maximum length of {} bytes", max_len));
    }
    
    // Remove null bytes and other control characters that could cause issues
    let sanitized: String = text
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
        .collect();
    
    Ok(sanitized)
}

// State wrappers
pub struct DbState(pub Arc<Database>);
pub struct RecorderState(pub Arc<Mutex<Option<AudioRecorder>>>);
pub struct TranscriberState(pub Arc<Mutex<Option<Transcriber>>>);
pub struct DownloaderState(pub Arc<ModelDownloader>);
pub struct LicenseClientState(pub Arc<LicenseClient>);
// Rate limiter: 100 requests per minute per action
pub struct RecordingRateLimiter(pub Arc<RateLimiter>);
pub struct TranscriptionRateLimiter(pub Arc<RateLimiter>);

// Error type for commands
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Recording error: {0}")]
    Recording(String),
    #[error("Transcription error: {0}")]
    Transcription(String),
    #[error("Download error: {0}")]
    Download(String),
    #[error("Text injection error: {0}")]
    TextInjection(String),
    #[error("License error: {0}")]
    License(String),
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

type CommandResult<T> = Result<T, CommandError>;

// ==================== Settings Commands ====================

#[tauri::command]
fn get_settings(db: State<DbState>) -> CommandResult<AppSettings> {
    db.0.get_settings().map_err(Into::into)
}

#[tauri::command]
fn update_settings(db: State<DbState>, settings: AppSettings) -> CommandResult<()> {
    db.0.update_settings(&settings).map_err(Into::into)
}

#[tauri::command]
fn update_setting(db: State<DbState>, key: String, value: String) -> CommandResult<()> {
    db.0.update_setting(&key, &value).map_err(Into::into)
}

// ==================== App State Commands ====================

#[tauri::command]
fn get_app_state(db: State<DbState>) -> CommandResult<AppState> {
    db.0.get_app_state().map_err(Into::into)
}

#[tauri::command]
fn update_app_state(db: State<DbState>, state: AppState) -> CommandResult<()> {
    db.0.update_app_state(&state).map_err(Into::into)
}

#[tauri::command]
fn set_setup_complete(db: State<DbState>, complete: bool) -> CommandResult<()> {
    db.0.set_setup_complete(complete).map_err(Into::into)
}

#[tauri::command]
fn set_current_setup_step(db: State<DbState>, step: i32) -> CommandResult<()> {
    db.0.set_current_setup_step(step).map_err(Into::into)
}

// ==================== Model Commands ====================

#[tauri::command]
fn get_models(db: State<DbState>) -> CommandResult<Vec<WhisperModel>> {
    db.0.get_models().map_err(Into::into)
}

#[tauri::command]
fn get_model(db: State<DbState>, id: String) -> CommandResult<Option<WhisperModel>> {
    db.0.get_model(&id).map_err(Into::into)
}

#[tauri::command]
fn set_model_downloaded(
    db: State<DbState>,
    id: String,
    downloaded: bool,
    path: Option<String>,
) -> CommandResult<()> {
    db.0.set_model_downloaded(&id, downloaded, path.as_deref())
        .map_err(Into::into)
}

#[tauri::command]
fn set_selected_model(db: State<DbState>, model_id: Option<String>) -> CommandResult<()> {
    db.0.set_selected_model(model_id.as_deref())
        .map_err(Into::into)
}

// ==================== Recording Commands ====================

#[tauri::command]
fn start_recording(
    recorder: State<RecorderState>,
    rate_limiter: State<RecordingRateLimiter>,
) -> CommandResult<()> {
    // Rate limiting check
    if !rate_limiter.0.check("start_recording") {
        return Err(CommandError::Recording("Rate limit exceeded. Please wait before starting another recording.".to_string()));
    }
    
    println!("[DEBUG] start_recording called");
    let mut recorder_guard = recorder.0.lock().unwrap();
    
    if recorder_guard.is_none() {
        println!("[DEBUG] Creating new AudioRecorder");
        *recorder_guard = Some(AudioRecorder::new().map_err(|e| {
            println!("[ERROR] Failed to create AudioRecorder: {}", e);
            CommandError::Recording(e)
        })?)
    }
    
    if let Some(ref mut rec) = *recorder_guard {
        println!("[DEBUG] Starting recording...");
        rec.start_recording().map_err(|e| {
            println!("[ERROR] Failed to start recording: {}", e);
            CommandError::Recording(e)
        })?;
        println!("[DEBUG] Recording started successfully");
    }
    
    Ok(())
}

#[tauri::command]
fn stop_recording(recorder: State<RecorderState>) -> CommandResult<Vec<f32>> {
    let mut recorder_guard = recorder.0.lock().unwrap();
    
    if let Some(ref mut rec) = *recorder_guard {
        let samples = rec.stop_recording().map_err(CommandError::Recording)?;
        Ok(samples)
    } else {
        Err(CommandError::Recording("No recorder initialized".to_string()))
    }
}

#[tauri::command]
fn cancel_recording(recorder: State<RecorderState>) -> CommandResult<()> {
    let mut recorder_guard = recorder.0.lock().unwrap();
    
    if let Some(ref mut rec) = *recorder_guard {
        rec.cancel_recording();
    }
    
    Ok(())
}

#[tauri::command]
fn is_recording(recorder: State<RecorderState>) -> bool {
    let recorder_guard = recorder.0.lock().unwrap();
    recorder_guard.as_ref().map(|r| r.is_recording()).unwrap_or(false)
}

// ==================== Transcription Commands ====================

#[tauri::command]
fn load_model(
    transcriber: State<TranscriberState>,
    downloader: State<DownloaderState>,
    model_id: String,
    language: String,
) -> CommandResult<()> {
    let model_path = downloader.0.get_model_path(&model_id);
    
    if !model_path.exists() {
        return Err(CommandError::Transcription(format!(
            "Model {} is not downloaded",
            model_id
        )));
    }
    
    let new_transcriber = Transcriber::new(
        model_path.to_str().unwrap(),
        &language,
    ).map_err(CommandError::Transcription)?;
    
    let mut transcriber_guard = transcriber.0.lock().unwrap();
    *transcriber_guard = Some(new_transcriber);
    
    Ok(())
}

#[tauri::command]
fn transcribe_audio(
    transcriber: State<TranscriberState>,
    audio_samples: Vec<f32>,
) -> CommandResult<String> {
    let transcriber_guard = transcriber.0.lock().unwrap();
    
    if let Some(ref t) = *transcriber_guard {
        let text = t.transcribe(&audio_samples).map_err(CommandError::Transcription)?;
        Ok(text)
    } else {
        Err(CommandError::Transcription("No model loaded".to_string()))
    }
}

#[tauri::command]
async fn record_and_transcribe(
    recorder: State<'_, RecorderState>,
    transcriber: State<'_, TranscriberState>,
) -> CommandResult<String> {
    // Stop recording first
    let samples = {
        let mut recorder_guard = recorder.0.lock().unwrap();
        if let Some(ref mut rec) = *recorder_guard {
            rec.stop_recording().map_err(CommandError::Recording)?
        } else {
            return Err(CommandError::Recording("No recorder initialized".to_string()));
        }
    };
    
    // Transcribe
    let transcriber_guard = transcriber.0.lock().unwrap();
    if let Some(ref t) = *transcriber_guard {
        let text = t.transcribe(&samples).map_err(CommandError::Transcription)?;
        Ok(text)
    } else {
        Err(CommandError::Transcription("No model loaded".to_string()))
    }
}

#[tauri::command]
async fn transcribe_file(
    transcriber: State<'_, TranscriberState>,
    rate_limiter: State<'_, TranscriptionRateLimiter>,
    file_path: String,
) -> CommandResult<String> {
    use std::path::Path;
    
    // Rate limiting check
    if !rate_limiter.0.check("transcribe_file") {
        return Err(CommandError::Transcription("Rate limit exceeded. Please wait before transcribing another file.".to_string()));
    }
    
    // Sanitize and validate file path
    let safe_path = sanitize_path(&file_path)
        .map_err(|e| CommandError::Transcription(e))?;
    
    let path = Path::new(&safe_path);
    if !path.exists() {
        return Err(CommandError::Transcription(format!("File not found: {}", safe_path)));
    }
    
    // Validate file extension
    let extension = path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());
    
    match extension.as_deref() {
        Some("wav") | Some("mp3") | Some("m4a") | Some("ogg") | Some("flac") => {}
        _ => {
            return Err(CommandError::Transcription(
                "Unsupported audio format. Please use WAV, MP3, M4A, OGG, or FLAC.".to_string()
            ));
        }
    }
    
    // Check file size (max 500MB)
    let metadata = std::fs::metadata(&safe_path)
        .map_err(|e| CommandError::Transcription(format!("Cannot read file: {}", e)))?;
    if metadata.len() > 500 * 1024 * 1024 {
        return Err(CommandError::Transcription("File too large. Maximum size is 500MB.".to_string()));
    }
    
    // Read audio file and convert to samples
    let samples = read_audio_file(&file_path)
        .map_err(|e| CommandError::Transcription(format!("Failed to read audio file: {}", e)))?;
    
    // Transcribe
    let transcriber_guard = transcriber.0.lock().unwrap();
    if let Some(ref t) = *transcriber_guard {
        let text = t.transcribe(&samples).map_err(CommandError::Transcription)?;
        Ok(text)
    } else {
        Err(CommandError::Transcription("No model loaded".to_string()))
    }
}

fn read_audio_file(file_path: &str) -> Result<Vec<f32>, String> {
    use std::fs::File;
    use std::io::BufReader;
    
    let file = File::open(file_path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    
    // Try to read as WAV file
    let reader = hound::WavReader::new(reader).map_err(|e| format!("Invalid WAV file: {}", e))?;
    
    let spec = reader.spec();
    let sample_rate = spec.sample_rate;
    let channels = spec.channels as usize;
    
    // Read all samples
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample;
            let max_val = (1i32 << (bits - 1)) as f32;
            reader
                .into_samples::<i32>()
                .filter_map(|s| s.ok())
                .map(|s| s as f32 / max_val)
                .collect()
        }
        hound::SampleFormat::Float => {
            reader
                .into_samples::<f32>()
                .filter_map(|s| s.ok())
                .collect()
        }
    };
    
    // Convert to mono if stereo
    let mono: Vec<f32> = if channels > 1 {
        samples
            .chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
            .collect()
    } else {
        samples
    };
    
    // Resample to 16kHz if needed
    let target_rate = 16000u32;
    let resampled = if sample_rate != target_rate {
        resample_audio(&mono, sample_rate, target_rate)
    } else {
        mono
    };
    
    Ok(resampled)
}

fn resample_audio(samples: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    let ratio = source_rate as f64 / target_rate as f64;
    let output_len = (samples.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;

        let sample = if idx + 1 < samples.len() {
            samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32
        } else if idx < samples.len() {
            samples[idx]
        } else {
            0.0
        };

        output.push(sample);
    }

    output
}

// ==================== Download Commands ====================

#[tauri::command]
async fn download_model(
    app: tauri::AppHandle,
    downloader: State<'_, DownloaderState>,
    db: State<'_, DbState>,
    model_id: String,
) -> CommandResult<String> {
    let app_clone = app.clone();
    let model_id_clone = model_id.clone();
    
    let model_path = downloader.0
        .download_model(&model_id, move |progress: DownloadProgress| {
            // Emit progress event to frontend
            let _ = app_clone.emit("download-progress", progress);
        })
        .await
        .map_err(CommandError::Download)?;
    
    // Update database
    let path_str = model_path.to_str().unwrap().to_string();
    db.0.set_model_downloaded(&model_id_clone, true, Some(&path_str))
        .map_err(CommandError::Database)?;
    
    Ok(path_str)
}

#[tauri::command]
async fn delete_model(
    downloader: State<'_, DownloaderState>,
    db: State<'_, DbState>,
    model_id: String,
) -> CommandResult<()> {
    downloader.0.delete_model(&model_id).await.map_err(CommandError::Download)?;
    db.0.set_model_downloaded(&model_id, false, None).map_err(CommandError::Database)?;
    Ok(())
}

#[tauri::command]
fn is_model_downloaded(downloader: State<DownloaderState>, model_id: String) -> bool {
    downloader.0.is_model_downloaded(&model_id)
}

#[tauri::command]
fn get_downloaded_models(downloader: State<DownloaderState>) -> Vec<String> {
    downloader.0.get_downloaded_models()
}

#[tauri::command]
fn get_model_path(downloader: State<DownloaderState>, model_id: String) -> String {
    downloader.0.get_model_path(&model_id).to_string_lossy().to_string()
}

// ==================== Text Injection Commands ====================

#[tauri::command]
fn inject_text(text: String) -> CommandResult<()> {
    // Sanitize input - limit text length and remove control characters
    let sanitized = sanitize_text(&text, 100_000)
        .map_err(|e| CommandError::TextInjection(e))?;
    
    if sanitized.is_empty() {
        return Err(CommandError::TextInjection("No text to inject".to_string()));
    }
    
    text_inject::inject_text_once(&sanitized).map_err(CommandError::TextInjection)
}

// ==================== Transcription History Commands ====================

#[tauri::command]
fn add_transcription(
    db: State<DbState>,
    text: String,
    model_id: String,
    language: String,
    duration_ms: i64,
) -> CommandResult<i64> {
    // Sanitize and validate text input
    let sanitized_text = sanitize_text(&text, 1_000_000)
        .map_err(|e| CommandError::Database(rusqlite::Error::InvalidParameterName(e)))?;
    
    if sanitized_text.is_empty() {
        return Err(CommandError::Database(rusqlite::Error::InvalidParameterName("Text cannot be empty".to_string())));
    }
    
    // Validate model_id against allowed values
    if !["tiny", "base", "small", "medium", "large"].contains(&model_id.as_str()) {
        return Err(CommandError::Database(rusqlite::Error::InvalidParameterName("Invalid model ID".to_string())));
    }
    
    // Validate language against allowed values
    if !["en", "bn", "auto"].contains(&language.as_str()) {
        return Err(CommandError::Database(rusqlite::Error::InvalidParameterName("Invalid language".to_string())));
    }
    
    // Validate duration range (0 to 1 hour in milliseconds)
    if duration_ms < 0 || duration_ms > 3_600_000 {
        return Err(CommandError::Database(rusqlite::Error::InvalidParameterName("Invalid duration".to_string())));
    }

    db.0.add_transcription(&sanitized_text, &model_id, &language, duration_ms)
        .map_err(Into::into)
}

#[tauri::command]
fn get_transcription_history(
    db: State<DbState>,
    limit: Option<i32>,
) -> CommandResult<Vec<TranscriptionHistory>> {
    // Validate and cap limit
    let safe_limit = limit.unwrap_or(50).min(1000).max(1);
    db.0.get_transcription_history(safe_limit)
        .map_err(Into::into)
}

#[tauri::command]
fn clear_transcription_history(db: State<DbState>) -> CommandResult<()> {
    db.0.clear_transcription_history().map_err(Into::into)
}

#[tauri::command]
fn delete_transcription(db: State<DbState>, id: i64) -> CommandResult<()> {
    db.0.delete_transcription(id).map_err(Into::into)
}

// ==================== License Commands ====================

// License response with computed trial days remaining
#[derive(Debug, serde::Serialize)]
struct LicenseResponse {
    license_key: Option<String>,
    activation_id: Option<String>,
    status: String,
    customer_email: Option<String>,
    customer_name: Option<String>,
    expires_at: Option<String>,
    is_activated: bool,
    last_validated_at: Option<String>,
    trial_started_at: Option<String>,
    trial_days_remaining: Option<i64>,
}

impl From<LicenseData> for LicenseResponse {
    fn from(data: LicenseData) -> Self {
        let trial_days_remaining = if let Some(ref trial_started) = data.trial_started_at {
            if let Ok(start_date) = chrono::DateTime::parse_from_rfc3339(trial_started) {
                let now = chrono::Utc::now();
                let days_since_start = (now - start_date.with_timezone(&chrono::Utc)).num_days();
                Some((7 - days_since_start).max(0))
            } else {
                None
            }
        } else {
            None
        };
        
        Self {
            license_key: data.license_key,
            activation_id: data.activation_id,
            status: data.status,
            customer_email: data.customer_email,
            customer_name: data.customer_name,
            expires_at: data.expires_at,
            is_activated: data.is_activated,
            last_validated_at: data.last_validated_at,
            trial_started_at: data.trial_started_at,
            trial_days_remaining,
        }
    }
}

#[tauri::command]
fn get_license(db: State<DbState>) -> CommandResult<LicenseResponse> {
    let license = db.0.get_license().map_err(CommandError::Database)?;
    Ok(LicenseResponse::from(license))
}

#[tauri::command]
async fn activate_license(
    db: State<'_, DbState>,
    license_client: State<'_, LicenseClientState>,
    license_key: String,
) -> CommandResult<LicenseResponse> {
    info!("Activating license key");
    
    // Get device info
    let device_label = get_device_label();
    let device_meta = get_device_meta();
    
    // Call Polar API to activate
    let license_info = license_client.0
        .activate(&license_key, &device_label, Some(device_meta))
        .await
        .map_err(CommandError::License)?;
    
    // Convert to LicenseData and save
    let license_data = LicenseData {
        license_key: Some(license_key),
        activation_id: license_info.activation_id,
        status: match license_info.status {
            LicenseStatus::Valid => "active".to_string(),
            LicenseStatus::Expired => "expired".to_string(),
            LicenseStatus::Revoked => "revoked".to_string(),
            LicenseStatus::Disabled => "disabled".to_string(),
            _ => "inactive".to_string(),
        },
        customer_email: license_info.customer_email,
        customer_name: license_info.customer_name,
        expires_at: license_info.expires_at,
        is_activated: license_info.status == LicenseStatus::Valid,
        last_validated_at: Some(chrono::Utc::now().to_rfc3339()),
        trial_started_at: None,
    };
    
    // Save to database
    db.0.save_license(&license_data).map_err(CommandError::Database)?;
    
    info!("License activated successfully");
    Ok(LicenseResponse::from(license_data))
}

#[tauri::command]
async fn validate_license(
    db: State<'_, DbState>,
    license_client: State<'_, LicenseClientState>,
) -> CommandResult<LicenseResponse> {
    // Get stored license
    let stored_license = db.0.get_license().map_err(CommandError::Database)?;
    
    let license_key = stored_license.license_key
        .ok_or_else(|| CommandError::License("No license key stored".to_string()))?;
    
    info!("Validating license key");
    
    // Call Polar API to validate
    let license_info = license_client.0
        .validate(&license_key, stored_license.activation_id.as_deref())
        .await
        .map_err(CommandError::License)?;
    
    // Update license data
    let license_data = LicenseData {
        license_key: Some(license_key),
        activation_id: license_info.activation_id.or(stored_license.activation_id),
        status: match license_info.status {
            LicenseStatus::Valid => "active".to_string(),
            LicenseStatus::Expired => "expired".to_string(),
            LicenseStatus::Revoked => "revoked".to_string(),
            LicenseStatus::Disabled => "disabled".to_string(),
            LicenseStatus::Invalid => "invalid".to_string(),
            LicenseStatus::NotActivated => "not_activated".to_string(),
            LicenseStatus::ActivationLimitReached => "activation_limit".to_string(),
            _ => "inactive".to_string(),
        },
        customer_email: license_info.customer_email.or(stored_license.customer_email),
        customer_name: license_info.customer_name.or(stored_license.customer_name),
        expires_at: license_info.expires_at.or(stored_license.expires_at),
        is_activated: license_info.status == LicenseStatus::Valid,
        last_validated_at: Some(chrono::Utc::now().to_rfc3339()),
        trial_started_at: stored_license.trial_started_at,
    };
    
    // Save to database
    db.0.save_license(&license_data).map_err(CommandError::Database)?;
    
    info!("License validated: {:?}", license_data.status);
    Ok(LicenseResponse::from(license_data))
}

#[tauri::command]
async fn deactivate_license(
    db: State<'_, DbState>,
    license_client: State<'_, LicenseClientState>,
) -> CommandResult<()> {
    // Get stored license
    let stored_license = db.0.get_license().map_err(CommandError::Database)?;
    
    let license_key = stored_license.license_key
        .ok_or_else(|| CommandError::License("No license key stored".to_string()))?;
    
    let activation_id = stored_license.activation_id
        .ok_or_else(|| CommandError::License("No activation ID stored".to_string()))?;
    
    info!("Deactivating license key");
    
    // Call Polar API to deactivate
    license_client.0
        .deactivate(&license_key, &activation_id)
        .await
        .map_err(CommandError::License)?;
    
    // Clear license from database
    db.0.clear_license().map_err(CommandError::Database)?;
    
    info!("License deactivated successfully");
    Ok(())
}

#[tauri::command]
fn clear_stored_license(db: State<DbState>) -> CommandResult<()> {
    db.0.clear_license().map_err(Into::into)
}

#[tauri::command]
fn is_license_valid(db: State<DbState>) -> bool {
    if let Ok(license) = db.0.get_license() {
        // Check if license is active OR if trial is active
        if license.is_activated && license.status == "active" {
            return true;
        }
        
        // Check trial status
        if license.status == "trial" {
            if let Some(trial_started) = &license.trial_started_at {
                if let Ok(start_date) = chrono::DateTime::parse_from_rfc3339(trial_started) {
                    let now = chrono::Utc::now();
                    let days_since_start = (now - start_date.with_timezone(&chrono::Utc)).num_days();
                    return days_since_start < 7;
                }
            }
        }
    }
    false
}

#[tauri::command]
fn start_trial(db: State<DbState>) -> CommandResult<LicenseResponse> {
    let mut license = db.0.get_license().map_err(CommandError::Database)?;
    
    // Check if already has active license
    if license.is_activated && license.status == "active" {
        return Err(CommandError::License("Already have an active license".to_string()));
    }
    
    // Check if trial already started
    if license.trial_started_at.is_some() {
        // Check if trial is still valid
        if let Some(ref trial_started) = license.trial_started_at {
            if let Ok(start_date) = chrono::DateTime::parse_from_rfc3339(trial_started) {
                let now = chrono::Utc::now();
                let days_since_start = (now - start_date.with_timezone(&chrono::Utc)).num_days();
                if days_since_start >= 7 {
                    license.status = "trial_expired".to_string();
                    db.0.save_license(&license).map_err(CommandError::Database)?;
                    return Err(CommandError::License("Trial has expired. Please purchase a license.".to_string()));
                }
            }
        }
        // Trial already active
        return Ok(LicenseResponse::from(license));
    }
    
    // Start new trial
    license.status = "trial".to_string();
    license.trial_started_at = Some(chrono::Utc::now().to_rfc3339());
    license.is_activated = false;
    
    db.0.save_license(&license).map_err(CommandError::Database)?;
    
    info!("Trial started");
    Ok(LicenseResponse::from(license))
}

#[tauri::command]
fn get_trial_status(db: State<DbState>) -> CommandResult<serde_json::Value> {
    let license = db.0.get_license().map_err(CommandError::Database)?;
    
    // Check for active license first
    if license.is_activated && license.status == "active" {
        return Ok(serde_json::json!({
            "isInTrial": false,
            "daysRemaining": 0,
            "trialExpired": false,
            "hasLicense": true
        }));
    }
    
    // Check trial status
    if let Some(trial_started) = &license.trial_started_at {
        if let Ok(start_date) = chrono::DateTime::parse_from_rfc3339(trial_started) {
            let now = chrono::Utc::now();
            let days_since_start = (now - start_date.with_timezone(&chrono::Utc)).num_days();
            let days_remaining = (7 - days_since_start).max(0);
            
            return Ok(serde_json::json!({
                "isInTrial": days_remaining > 0,
                "daysRemaining": days_remaining,
                "trialExpired": days_remaining <= 0,
                "hasLicense": false
            }));
        }
    }
    
    // No trial started
    Ok(serde_json::json!({
        "isInTrial": false,
        "daysRemaining": 0,
        "trialExpired": false,
        "hasLicense": false
    }))
}

#[tauri::command]
fn can_use_app(db: State<DbState>) -> CommandResult<serde_json::Value> {
    let license = db.0.get_license().map_err(CommandError::Database)?;
    
    // Check for active license
    if license.is_activated && license.status == "active" {
        return Ok(serde_json::json!({
            "canUse": true,
            "reason": "licensed",
            "daysRemaining": null
        }));
    }
    
    // Check trial status
    if let Some(trial_started) = &license.trial_started_at {
        if let Ok(start_date) = chrono::DateTime::parse_from_rfc3339(trial_started) {
            let now = chrono::Utc::now();
            let days_since_start = (now - start_date.with_timezone(&chrono::Utc)).num_days();
            let days_remaining = (7 - days_since_start).max(0);
            
            if days_remaining > 0 {
                return Ok(serde_json::json!({
                    "canUse": true,
                    "reason": "trial",
                    "daysRemaining": days_remaining
                }));
            } else {
                return Ok(serde_json::json!({
                    "canUse": false,
                    "reason": "trial_expired",
                    "daysRemaining": 0
                }));
            }
        }
    }
    
    // No license and no trial
    Ok(serde_json::json!({
        "canUse": false,
        "reason": "no_license",
        "daysRemaining": null
    }))
}

// ==================== Utility Commands ====================

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> CommandResult<String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string()))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_models_dir(app: tauri::AppHandle) -> CommandResult<String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string()))?;
    Ok(path.join("models").to_string_lossy().to_string())
}

// ==================== Hotkey Commands ====================

#[tauri::command]
fn register_hotkey(app: tauri::AppHandle, hotkey: String) -> CommandResult<()> {
    let shortcut = parse_hotkey(&hotkey)
        .map_err(|e| CommandError::Recording(format!("Invalid hotkey: {}", e)))?;
    
    println!("Registering hotkey: {} -> {:?}", hotkey, shortcut);
    
    // Unregister all existing shortcuts first
    if let Err(e) = app.global_shortcut().unregister_all() {
        println!("Warning: Failed to unregister existing shortcuts: {}", e);
    }
    
    // Register the new shortcut with handler
    let result = app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
        println!("Shortcut event: {:?}", event.state());
        match event.state() {
            ShortcutState::Pressed => {
                println!("Emitting hotkey-pressed");
                if let Err(e) = app.emit("hotkey-pressed", ()) {
                    println!("Failed to emit hotkey-pressed: {}", e);
                }
            }
            ShortcutState::Released => {
                println!("Emitting hotkey-released");
                if let Err(e) = app.emit("hotkey-released", ()) {
                    println!("Failed to emit hotkey-released: {}", e);
                }
            }
        }
    });
    
    match result {
        Ok(_) => {
            println!("Hotkey registered successfully");
            Ok(())
        }
        Err(e) => {
            println!("Failed to register hotkey: {}", e);
            Err(CommandError::Recording(format!("Failed to register hotkey: {}", e)))
        }
    }
}

#[tauri::command]
fn unregister_hotkeys(app: tauri::AppHandle) -> CommandResult<()> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| CommandError::Recording(format!("Failed to unregister hotkeys: {}", e)))?;
    Ok(())
}

fn parse_hotkey(hotkey: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = hotkey.split('+').map(|s| s.trim()).collect();
    
    if parts.is_empty() {
        return Err("Empty hotkey".to_string());
    }
    
    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;
    
    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "super" | "meta" | "win" | "cmd" => modifiers |= Modifiers::SUPER,
            "space" => key_code = Some(Code::Space),
            "enter" | "return" => key_code = Some(Code::Enter),
            "tab" => key_code = Some(Code::Tab),
            "escape" | "esc" => key_code = Some(Code::Escape),
            "backspace" => key_code = Some(Code::Backspace),
            "delete" => key_code = Some(Code::Delete),
            "f1" => key_code = Some(Code::F1),
            "f2" => key_code = Some(Code::F2),
            "f3" => key_code = Some(Code::F3),
            "f4" => key_code = Some(Code::F4),
            "f5" => key_code = Some(Code::F5),
            "f6" => key_code = Some(Code::F6),
            "f7" => key_code = Some(Code::F7),
            "f8" => key_code = Some(Code::F8),
            "f9" => key_code = Some(Code::F9),
            "f10" => key_code = Some(Code::F10),
            "f11" => key_code = Some(Code::F11),
            "f12" => key_code = Some(Code::F12),
            s if s.len() == 1 => {
                let c = s.chars().next().unwrap().to_ascii_uppercase();
                key_code = match c {
                    'A' => Some(Code::KeyA),
                    'B' => Some(Code::KeyB),
                    'C' => Some(Code::KeyC),
                    'D' => Some(Code::KeyD),
                    'E' => Some(Code::KeyE),
                    'F' => Some(Code::KeyF),
                    'G' => Some(Code::KeyG),
                    'H' => Some(Code::KeyH),
                    'I' => Some(Code::KeyI),
                    'J' => Some(Code::KeyJ),
                    'K' => Some(Code::KeyK),
                    'L' => Some(Code::KeyL),
                    'M' => Some(Code::KeyM),
                    'N' => Some(Code::KeyN),
                    'O' => Some(Code::KeyO),
                    'P' => Some(Code::KeyP),
                    'Q' => Some(Code::KeyQ),
                    'R' => Some(Code::KeyR),
                    'S' => Some(Code::KeyS),
                    'T' => Some(Code::KeyT),
                    'U' => Some(Code::KeyU),
                    'V' => Some(Code::KeyV),
                    'W' => Some(Code::KeyW),
                    'X' => Some(Code::KeyX),
                    'Y' => Some(Code::KeyY),
                    'Z' => Some(Code::KeyZ),
                    '0' => Some(Code::Digit0),
                    '1' => Some(Code::Digit1),
                    '2' => Some(Code::Digit2),
                    '3' => Some(Code::Digit3),
                    '4' => Some(Code::Digit4),
                    '5' => Some(Code::Digit5),
                    '6' => Some(Code::Digit6),
                    '7' => Some(Code::Digit7),
                    '8' => Some(Code::Digit8),
                    '9' => Some(Code::Digit9),
                    _ => return Err(format!("Unknown key: {}", s)),
                };
            }
            _ => return Err(format!("Unknown key or modifier: {}", part)),
        }
    }
    
    let code = key_code.ok_or("No key specified in hotkey")?;
    
    Ok(Shortcut::new(Some(modifiers), code))
}

// App version command for frontend
#[tauri::command]
fn get_app_version() -> String {
    APP_VERSION.to_string()
}

#[tauri::command]
fn get_app_name() -> String {
    APP_NAME.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();
    
    info!("Starting {} v{}", APP_NAME, APP_VERSION);
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            info!("Initializing application...");
            
            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            
            info!("App data directory: {:?}", app_data_dir);
            
            let db = Database::new(app_data_dir.clone()).expect("Failed to initialize database");
            app.manage(DbState(Arc::new(db)));
            
            // Initialize recorder state
            app.manage(RecorderState(Arc::new(Mutex::new(None))));
            
            // Initialize transcriber state
            app.manage(TranscriberState(Arc::new(Mutex::new(None))));
            
            // Initialize downloader
            let models_dir = app_data_dir.join("models");
            app.manage(DownloaderState(Arc::new(ModelDownloader::new(models_dir))));
            
            // Initialize license client
            app.manage(LicenseClientState(Arc::new(LicenseClient::new(Some(POLAR_ORG_ID.to_string())))));
            
            // Initialize rate limiters (100 requests per 60 seconds)
            app.manage(RecordingRateLimiter(Arc::new(RateLimiter::new(100, 60))));
            app.manage(TranscriptionRateLimiter(Arc::new(RateLimiter::new(50, 60))));
            
            // Setup system tray
            setup_tray(app)?;
            
            info!("Application initialized successfully");
            
            // Note: Hotkey is registered from the frontend via register_hotkey command
            // This allows the frontend to control which hotkey is used based on settings
            
            Ok(())
        })
        .on_window_event(|window, event| {
            // Handle window close to minimize to tray instead
            if let WindowEvent::CloseRequested { api, .. } = event {
                debug!("Window close requested, hiding to tray");
                // Hide window instead of closing
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            get_settings,
            update_settings,
            update_setting,
            // App state
            get_app_state,
            update_app_state,
            set_setup_complete,
            set_current_setup_step,
            // Models
            get_models,
            get_model,
            set_model_downloaded,
            set_selected_model,
            // Recording
            start_recording,
            stop_recording,
            cancel_recording,
            is_recording,
            // Transcription
            load_model,
            transcribe_audio,
            record_and_transcribe,
            transcribe_file,
            // Download
            download_model,
            delete_model,
            is_model_downloaded,
            get_downloaded_models,
            get_model_path,
            // Text injection
            inject_text,
            // Transcription history
            add_transcription,
            get_transcription_history,
            clear_transcription_history,
            delete_transcription,
            // License
            get_license,
            activate_license,
            validate_license,
            deactivate_license,
            clear_stored_license,
            is_license_valid,
            start_trial,
            get_trial_status,
            can_use_app,
            // Utility
            get_app_data_dir,
            get_models_dir,
            // Hotkeys
            register_hotkey,
            unregister_hotkeys,
            // App info
            get_app_version,
            get_app_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create tray menu items
    let show_item = MenuItem::with_id(app, "show", "Show WaveType", true, None::<&str>)?;
    let start_recording_item = MenuItem::with_id(app, "start_recording", "Start Recording", true, None::<&str>)?;
    let stop_recording_item = MenuItem::with_id(app, "stop_recording", "Stop Recording", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep", "────────────", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    // Build menu
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &separator,
            &start_recording_item,
            &stop_recording_item,
            &separator,
            &quit_item,
        ],
    )?;
    
    // Get the icon - use default window icon as fallback
    let icon = app.default_window_icon().cloned().ok_or("No default icon")?;
    
    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("WaveType - Voice to Text")
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "start_recording" => {
                    let _ = app.emit("tray-start-recording", ());
                }
                "stop_recording" => {
                    let _ = app.emit("tray-stop-recording", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    
    Ok(())
}
