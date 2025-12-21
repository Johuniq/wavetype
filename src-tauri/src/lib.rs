#![recursion_limit = "512"]

mod audio;
mod database;
mod downloader;
mod error_reporting;
mod license;
mod post_process;
mod security;
mod text_inject;
mod transcription;

use audio::AudioRecorder;
use database::{AppSettings, AppState, Database, LicenseData, TranscriptionHistory, WhisperModel};
use downloader::{DownloadProgress, ModelDownloader};
use error_reporting::{ErrorCategory, ErrorReport, ErrorReporter, ErrorSeverity, ErrorStats};
use license::{
    clear_cache, get_device_id, get_device_label, LicenseInfo, LicenseManager, LicenseStatus,
};
use log::{debug, error, info, warn};
use post_process::PostProcessor;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
    // Handle Unix-like paths (starting with /)
    if normalized.starts_with('/') {
        // Allow paths within WaveType app directories, temp, home, or Users
        if !normalized.contains("/WaveType/")
            && !normalized.starts_with("/tmp/")
            && !normalized.starts_with("/home/")
            && !normalized.starts_with("/Users/")
        {
            warn!("Access to restricted path attempted: {}", normalized);
            return Err("Invalid path: outside allowed directories".to_string());
        }
    }
    // Handle Windows paths (drive letters like C:, D:, etc.)
    else if normalized.len() >= 2 
        && normalized.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false)
        && normalized.chars().nth(1) == Some(':')
    {
        // Windows absolute path - allow if it contains WaveType or is in user directories
        // Note: Windows paths are typically handled by Tauri's path helpers,
        // but we validate here as an extra safety measure
        if !normalized.contains("WaveType") 
            && !normalized.contains("AppData")
            && !normalized.contains("Users")
        {
            warn!("Access to restricted Windows path attempted: {}", normalized);
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
pub struct LicenseManagerState(pub Arc<LicenseManager>);
pub struct TextInjectorState(pub Arc<Mutex<text_inject::TextInjector>>);
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
    #[error("Post-processing error: {0}")]
    PostProcessing(String),
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
        return Err(CommandError::Recording(
            "Rate limit exceeded. Please wait before starting another recording.".to_string(),
        ));
    }

    debug!("start_recording called");
    let mut recorder_guard = recorder.0.lock().unwrap();

    if recorder_guard.is_none() {
        debug!("Creating new AudioRecorder");
        *recorder_guard = Some(AudioRecorder::new().map_err(|e| {
            error!("Failed to create AudioRecorder: {}", e);
            CommandError::Recording(e)
        })?)
    }

    if let Some(ref mut rec) = *recorder_guard {
        debug!("Starting recording...");
        rec.start_recording().map_err(|e| {
            error!("Failed to start recording: {}", e);
            CommandError::Recording(e)
        })?;
        debug!("Recording started successfully");
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
        Err(CommandError::Recording(
            "No recorder initialized".to_string(),
        ))
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
    recorder_guard
        .as_ref()
        .map(|r| r.is_recording())
        .unwrap_or(false)
}

// ==================== Recording Overlay Commands ====================

#[tauri::command]
async fn show_recording_overlay(app: tauri::AppHandle) -> CommandResult<()> {
    use tauri::Manager;

    if let Some(overlay_window) = app.get_webview_window("recording-overlay") {
        // Show the overlay window
        overlay_window.show().map_err(|e| {
            error!("Failed to show overlay window: {}", e);
            CommandError::Recording(format!("Failed to show overlay: {}", e))
        })?;

        // Set it to fullscreen and always on top
        overlay_window.set_fullscreen(true).map_err(|e| {
            warn!("Failed to set fullscreen: {}", e);
            CommandError::Recording(format!("Failed to set fullscreen: {}", e))
        })?;

        overlay_window.set_always_on_top(true).map_err(|e| {
            warn!("Failed to set always on top: {}", e);
            CommandError::Recording(format!("Failed to set always on top: {}", e))
        })?;

        debug!("Recording overlay shown");
    } else {
        warn!("Recording overlay window not found");
    }

    Ok(())
}

#[tauri::command]
async fn hide_recording_overlay(app: tauri::AppHandle) -> CommandResult<()> {
    use tauri::Manager;

    if let Some(overlay_window) = app.get_webview_window("recording-overlay") {
        // Hide the overlay window
        overlay_window.hide().map_err(|e| {
            error!("Failed to hide overlay window: {}", e);
            CommandError::Recording(format!("Failed to hide overlay: {}", e))
        })?;

        debug!("Recording overlay hidden");
    }

    Ok(())
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

    // Drop existing model first to free memory before loading new one
    {
        let mut transcriber_guard = transcriber.0.lock().unwrap();
        *transcriber_guard = None;
        // Force memory release by dropping the guard
        drop(transcriber_guard);
    }

    // Load new model
    let new_transcriber = Transcriber::new(model_path.to_str().unwrap(), &language)
        .map_err(CommandError::Transcription)?;

    let mut transcriber_guard = transcriber.0.lock().unwrap();
    *transcriber_guard = Some(new_transcriber);

    info!("Model loaded: {} (language: {})", model_id, language);

    Ok(())
}

#[tauri::command]
fn unload_model(transcriber: State<TranscriberState>) -> CommandResult<()> {
    let mut transcriber_guard = transcriber.0.lock().unwrap();
    *transcriber_guard = None;
    info!("Model unloaded");
    Ok(())
}

#[tauri::command]
fn transcribe_audio(
    transcriber: State<TranscriberState>,
    audio_samples: Vec<f32>,
) -> CommandResult<String> {
    let transcriber_guard = transcriber.0.lock().unwrap();

    if let Some(ref t) = *transcriber_guard {
        let text = t
            .transcribe(&audio_samples)
            .map_err(CommandError::Transcription)?;
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
            return Err(CommandError::Recording(
                "No recorder initialized".to_string(),
            ));
        }
    };

    // Transcribe
    let transcriber_guard = transcriber.0.lock().unwrap();
    if let Some(ref t) = *transcriber_guard {
        let text = t
            .transcribe(&samples)
            .map_err(CommandError::Transcription)?;
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
        return Err(CommandError::Transcription(
            "Rate limit exceeded. Please wait before transcribing another file.".to_string(),
        ));
    }

    // Sanitize and validate file path
    let safe_path = sanitize_path(&file_path).map_err(|e| CommandError::Transcription(e))?;

    let path = Path::new(&safe_path);
    if !path.exists() {
        return Err(CommandError::Transcription(format!(
            "File not found: {}",
            safe_path
        )));
    }

    // Validate file extension
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    match extension.as_deref() {
        Some("wav") | Some("mp3") | Some("m4a") | Some("ogg") | Some("flac") | Some("aac")
        | Some("webm") | Some("mkv") => {}
        _ => {
            return Err(CommandError::Transcription(
                "Unsupported audio format. Please use WAV, MP3, M4A, OGG, FLAC, AAC, or WebM."
                    .to_string(),
            ));
        }
    }

    // Check file size (max 500MB)
    let metadata = std::fs::metadata(&safe_path)
        .map_err(|e| CommandError::Transcription(format!("Cannot read file: {}", e)))?;
    if metadata.len() > 500 * 1024 * 1024 {
        return Err(CommandError::Transcription(
            "File too large. Maximum size is 500MB.".to_string(),
        ));
    }

    // Read audio file and convert to samples
    let samples = read_audio_file(&file_path)
        .map_err(|e| CommandError::Transcription(format!("Failed to read audio file: {}", e)))?;

    // Transcribe
    let transcriber_guard = transcriber.0.lock().unwrap();
    if let Some(ref t) = *transcriber_guard {
        let text = t
            .transcribe(&samples)
            .map_err(CommandError::Transcription)?;
        Ok(text)
    } else {
        Err(CommandError::Transcription("No model loaded".to_string()))
    }
}

fn read_audio_file(file_path: &str) -> Result<Vec<f32>, String> {
    use std::fs::File;
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;

    // Create a media source stream
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Create a hint to help the format registry guess what format reader is appropriate
    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }

    // Probe the media source
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Failed to probe audio format: {}", e))?;

    let mut format = probed.format;

    // Find the first audio track
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or_else(|| "No audio track found".to_string())?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);

    // Create a decoder
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {}", e))?;

    let mut all_samples: Vec<f32> = Vec::new();

    // Decode all packets
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(symphonia::core::errors::Error::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(e) => return Err(format!("Failed to read packet: {}", e)),
        };

        // Skip packets from other tracks
        if packet.track_id() != track_id {
            continue;
        }

        // Decode the packet
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("Failed to decode: {}", e)),
        };

        // Convert to f32 samples
        let spec = *decoded.spec();
        let duration = decoded.capacity() as u64;
        let mut sample_buf = SampleBuffer::<f32>::new(duration, spec);
        sample_buf.copy_interleaved_ref(decoded);

        all_samples.extend_from_slice(sample_buf.samples());
    }

    // Convert to mono if needed
    let mono: Vec<f32> = if channels > 1 {
        all_samples
            .chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
            .collect()
    } else {
        all_samples
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

    let model_path = downloader
        .0
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
    downloader
        .0
        .delete_model(&model_id)
        .await
        .map_err(CommandError::Download)?;
    db.0.set_model_downloaded(&model_id, false, None)
        .map_err(CommandError::Database)?;
    Ok(())
}

#[tauri::command]
fn is_model_downloaded(downloader: State<DownloaderState>, model_id: String) -> CommandResult<bool> {
    // Validate model_id against allowed values
    const VALID_MODEL_IDS: &[&str] = &[
        "tiny", "base", "small", "medium", "large", "large-v3", "large-v3-turbo",
        "tiny.en", "base.en", "small.en", "medium.en",
        "distil-small.en", "distil-medium.en", "distil-large-v2", "distil-large-v3",
    ];
    if !VALID_MODEL_IDS.contains(&model_id.as_str()) {
        return Err(CommandError::Database(
            rusqlite::Error::InvalidParameterName("Invalid model ID".to_string()),
        ));
    }
    Ok(downloader.0.is_model_downloaded(&model_id))
}

#[tauri::command]
fn get_downloaded_models(downloader: State<DownloaderState>) -> Vec<String> {
    downloader.0.get_downloaded_models()
}

#[tauri::command]
fn get_model_path(downloader: State<DownloaderState>, model_id: String) -> CommandResult<String> {
    // Validate model_id against allowed values
    const VALID_MODEL_IDS: &[&str] = &[
        "tiny", "base", "small", "medium", "large", "large-v3", "large-v3-turbo",
        "tiny.en", "base.en", "small.en", "medium.en",
        "distil-small.en", "distil-medium.en", "distil-large-v2", "distil-large-v3",
    ];
    if !VALID_MODEL_IDS.contains(&model_id.as_str()) {
        return Err(CommandError::Database(
            rusqlite::Error::InvalidParameterName("Invalid model ID".to_string()),
        ));
    }
    Ok(downloader
        .0
        .get_model_path(&model_id)
        .to_string_lossy()
        .to_string())
}

// ==================== Post-Processing Commands ====================

#[tauri::command]
fn post_process_text(text: String) -> CommandResult<String> {
    let sanitized = sanitize_text(&text, 100_000).map_err(|e| CommandError::PostProcessing(e))?;

    if sanitized.is_empty() {
        return Ok(String::new());
    }

    let processor = PostProcessor::new();
    let processed = processor.process(&sanitized);

    Ok(processed)
}

// ==================== Text Injection Commands ====================

#[tauri::command]
fn inject_text(injector: State<TextInjectorState>, text: String) -> CommandResult<()> {
    // Sanitize input - limit text length and remove control characters
    let sanitized = sanitize_text(&text, 100_000).map_err(|e| CommandError::TextInjection(e))?;

    if sanitized.is_empty() {
        return Err(CommandError::TextInjection("No text to inject".to_string()));
    }

    // Reuse injector instance for better performance (avoids recreating each time)
    let mut injector_guard = injector.0.lock().unwrap();
    injector_guard
        .inject_text(&sanitized)
        .map_err(CommandError::TextInjection)
}

#[tauri::command]
fn execute_keyboard_shortcut(injector: State<TextInjectorState>, shortcut: String) -> CommandResult<()> {
    // Validate shortcut against allowed values
    let allowed_shortcuts = [
        "undo",
        "redo",
        "copy",
        "cut",
        "paste",
        "select_all",
        "backspace_word",
        "backspace",
        "delete_word",
        "delete_line",
        "enter",
        "tab",
        "escape",
        "left",
        "right",
        "up",
        "down",
        "home",
        "end",
        "word_left",
        "word_right",
    ];
    if !allowed_shortcuts.contains(&shortcut.as_str()) {
        return Err(CommandError::TextInjection(format!(
            "Invalid shortcut: {}",
            shortcut
        )));
    }

    // Reuse injector instance for better performance
    let mut injector_guard = injector.0.lock().unwrap();
    injector_guard
        .execute_shortcut(&shortcut)
        .map_err(CommandError::TextInjection)
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
        return Err(CommandError::Database(
            rusqlite::Error::InvalidParameterName("Text cannot be empty".to_string()),
        ));
    }

    // Validate model_id against allowed values
    const VALID_MODEL_IDS: &[&str] = &[
        // Whisper models
        "tiny",
        "base",
        "small",
        "medium",
        "large",
        "large-v3",
        "large-v3-turbo",
        "tiny.en",
        "base.en",
        "small.en",
        "medium.en",
        "distil-small.en",
        "distil-medium.en",
        "distil-large-v2",
        "distil-large-v3",
    ];
    if !VALID_MODEL_IDS.contains(&model_id.as_str()) {
        return Err(CommandError::Database(
            rusqlite::Error::InvalidParameterName("Invalid model ID".to_string()),
        ));
    }

    // Validate language against allowed values
    if !["en", "bn", "auto"].contains(&language.as_str()) {
        return Err(CommandError::Database(
            rusqlite::Error::InvalidParameterName("Invalid language".to_string()),
        ));
    }

    // Validate duration range (0 to 1 hour in milliseconds)
    if duration_ms < 0 || duration_ms > 3_600_000 {
        return Err(CommandError::Database(
            rusqlite::Error::InvalidParameterName("Invalid duration".to_string()),
        ));
    }

    db.0.add_transcription(&sanitized_text, &model_id, &language, duration_ms)
        .map_err(Into::into)
}

#[tauri::command]
fn get_transcription_history(
    db: State<DbState>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> CommandResult<Vec<TranscriptionHistory>> {
    // Validate and cap limit
    let safe_limit = limit.unwrap_or(50).min(1000).max(1);
    let safe_offset = offset.unwrap_or(0).max(0);
    db.0.get_transcription_history(safe_limit, safe_offset)
        .map_err(Into::into)
}

#[tauri::command]
fn get_transcription_history_count(db: State<DbState>) -> CommandResult<i64> {
    db.0.get_transcription_history_count().map_err(Into::into)
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

// License response for frontend
#[derive(Debug, serde::Serialize)]
struct LicenseResponse {
    license_key: Option<String>,
    display_key: Option<String>,
    activation_id: Option<String>,
    status: String,
    customer_email: Option<String>,
    customer_name: Option<String>,
    benefit_id: Option<String>,
    expires_at: Option<String>,
    is_activated: bool,
    last_validated_at: Option<String>,
    trial_started_at: Option<String>,
    trial_days_remaining: Option<i64>,
    device_id: String,
    device_label: String,
    limit_activations: Option<i32>,
    usage: i32,
    validations: i32,
}

impl From<LicenseInfo> for LicenseResponse {
    fn from(info: LicenseInfo) -> Self {
        Self {
            license_key: Some(info.license_key),
            display_key: Some(info.display_key),
            activation_id: info.activation_id,
            status: match info.status {
                LicenseStatus::Granted => "active".to_string(),
                LicenseStatus::Revoked => "revoked".to_string(),
                LicenseStatus::Disabled => "disabled".to_string(),
                LicenseStatus::Expired => "expired".to_string(),
                LicenseStatus::Invalid => "invalid".to_string(),
                LicenseStatus::ActivationLimitReached => "activation_limit".to_string(),
                LicenseStatus::Offline => "active".to_string(), // Offline but valid
                LicenseStatus::NotActivated => "not_activated".to_string(),
            },
            customer_email: info.customer_email,
            customer_name: info.customer_name,
            benefit_id: info.benefit_id,
            expires_at: info.expires_at,
            is_activated: info.status.allows_usage(),
            last_validated_at: info.last_validated_at,
            trial_started_at: None,
            trial_days_remaining: None,
            device_id: info.device_id,
            device_label: info.device_label,
            limit_activations: info.limit_activations,
            usage: info.usage,
            validations: info.validations,
        }
    }
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
            display_key: None,
            activation_id: data.activation_id,
            status: data.status,
            customer_email: data.customer_email,
            customer_name: data.customer_name,
            benefit_id: None,
            expires_at: data.expires_at,
            is_activated: data.is_activated,
            last_validated_at: data.last_validated_at,
            trial_started_at: data.trial_started_at,
            trial_days_remaining,
            device_id: get_device_id(),
            device_label: get_device_label(),
            limit_activations: None,
            usage: data.usage,
            validations: data.validations,
        }
    }
}

#[tauri::command]
fn get_license(
    db: State<DbState>,
    license_manager: State<LicenseManagerState>,
) -> CommandResult<LicenseResponse> {
    // First try to get from secure cache
    if let Some(info) = license_manager.0.get_cached_info() {
        return Ok(LicenseResponse::from(info));
    }

    // Fall back to database
    let license = db.0.get_license().map_err(CommandError::Database)?;
    Ok(LicenseResponse::from(license))
}

#[tauri::command]
async fn activate_license(
    db: State<'_, DbState>,
    license_manager: State<'_, LicenseManagerState>,
    license_key: String,
) -> CommandResult<LicenseResponse> {
    info!("Activating license key...");

    // Activate using the new LicenseManager
    let license_info = license_manager
        .0
        .activate(&license_key)
        .await
        .map_err(CommandError::License)?;

    // Also save to database as backup
    let license_data = LicenseData {
        license_key: Some(license_key),
        activation_id: license_info.activation_id.clone(),
        status: "active".to_string(),
        customer_email: license_info.customer_email.clone(),
        customer_name: license_info.customer_name.clone(),
        expires_at: license_info.expires_at.clone(),
        is_activated: true,
        last_validated_at: Some(chrono::Utc::now().to_rfc3339()),
        trial_started_at: None,
        usage: license_info.usage,
        validations: license_info.validations,
    };

    db.0.save_license(&license_data)
        .map_err(CommandError::Database)?;

    info!("License activated successfully!");
    Ok(LicenseResponse::from(license_info))
}

#[tauri::command]
async fn validate_license(
    db: State<'_, DbState>,
    license_manager: State<'_, LicenseManagerState>,
) -> CommandResult<LicenseResponse> {
    info!("Validating license...");

    // Validate using the new LicenseManager
    let license_info = license_manager
        .0
        .validate()
        .await
        .map_err(CommandError::License)?;

    // Update database
    let license_data = LicenseData {
        license_key: Some(license_info.license_key.clone()),
        activation_id: license_info.activation_id.clone(),
        status: match license_info.status {
            LicenseStatus::Granted | LicenseStatus::Offline => "active".to_string(),
            LicenseStatus::Expired => "expired".to_string(),
            LicenseStatus::Revoked => "revoked".to_string(),
            LicenseStatus::Disabled => "disabled".to_string(),
            _ => "inactive".to_string(),
        },
        customer_email: license_info.customer_email.clone(),
        customer_name: license_info.customer_name.clone(),
        expires_at: license_info.expires_at.clone(),
        is_activated: license_info.status.allows_usage(),
        last_validated_at: license_info.last_validated_at.clone(),
        trial_started_at: None,
        usage: license_info.usage,
        validations: license_info.validations,
    };

    let _ = db.0.save_license(&license_data);

    info!("License validated: {:?}", license_info.status);
    Ok(LicenseResponse::from(license_info))
}

#[tauri::command]
async fn deactivate_license(
    db: State<'_, DbState>,
    license_manager: State<'_, LicenseManagerState>,
) -> CommandResult<()> {
    info!("Deactivating license...");

    // Deactivate using the new LicenseManager
    license_manager
        .0
        .deactivate()
        .await
        .map_err(CommandError::License)?;

    // Clear database
    db.0.clear_license().map_err(CommandError::Database)?;

    info!("License deactivated successfully");
    Ok(())
}

#[tauri::command]
fn clear_stored_license(db: State<DbState>) -> CommandResult<()> {
    let _ = clear_cache();
    db.0.clear_license().map_err(Into::into)
}

#[tauri::command]
fn is_license_valid(db: State<DbState>, license_manager: State<LicenseManagerState>) -> bool {
    // First check with license manager (secure cache)
    if license_manager.0.is_valid() {
        return true;
    }

    // Fall back to database for trial check
    if let Ok(license) = db.0.get_license() {
        // Check trial status
        if license.status == "trial" {
            if let Some(trial_started) = &license.trial_started_at {
                if let Ok(start_date) = chrono::DateTime::parse_from_rfc3339(trial_started) {
                    let now = chrono::Utc::now();
                    let days_since_start =
                        (now - start_date.with_timezone(&chrono::Utc)).num_days();
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
        return Err(CommandError::License(
            "Already have an active license".to_string(),
        ));
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
                    db.0.save_license(&license)
                        .map_err(CommandError::Database)?;
                    return Err(CommandError::License(
                        "Trial has expired. Please purchase a license.".to_string(),
                    ));
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

    db.0.save_license(&license)
        .map_err(CommandError::Database)?;

    info!("Trial started");
    Ok(LicenseResponse::from(license))
}

/// Get device information for license display
#[tauri::command]
fn get_device_info() -> serde_json::Value {
    serde_json::json!({
        "device_id": get_device_id(),
        "device_label": get_device_label(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
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
    let path = app.path().app_data_dir().map_err(|e: tauri::Error| {
        std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string())
    })?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_models_dir(app: tauri::AppHandle) -> CommandResult<String> {
    let path = app.path().app_data_dir().map_err(|e: tauri::Error| {
        std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string())
    })?;
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
    let result = app
        .global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
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
            Err(CommandError::Recording(format!(
                "Failed to register hotkey: {}",
                e
            )))
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

// Error Reporting Commands

#[tauri::command]
async fn report_error(
    app: tauri::AppHandle,
    category: String,
    message: String,
    severity: String,
    stack_trace: Option<String>,
    user_action: Option<String>,
    context: Option<std::collections::HashMap<String, String>>,
) -> Result<(), CommandError> {
    let severity = match severity.to_lowercase().as_str() {
        "debug" => ErrorSeverity::Debug,
        "info" => ErrorSeverity::Info,
        "warning" => ErrorSeverity::Warning,
        "error" => ErrorSeverity::Error,
        "critical" => ErrorSeverity::Critical,
        "fatal" => ErrorSeverity::Fatal,
        _ => ErrorSeverity::Error,
    };

    let category = match category.to_lowercase().as_str() {
        "transcription" => ErrorCategory::Transcription,
        "audio" => ErrorCategory::Audio,
        "model" => ErrorCategory::Model,
        "database" => ErrorCategory::Database,
        "network" => ErrorCategory::Network,
        "filesystem" => ErrorCategory::FileSystem,
        "license" => ErrorCategory::License,
        "ui" => ErrorCategory::Ui,
        "system" => ErrorCategory::System,
        "configuration" => ErrorCategory::Configuration,
        _ => ErrorCategory::Unknown,
    };

    if let Some(reporter) = ErrorReporter::global() {
        let mut report = ErrorReport::new(severity, category, message);

        if let Some(trace) = stack_trace {
            report = report.with_details(trace);
        }

        if let Some(action) = user_action {
            report = report.with_context("user_action", action);
        }

        if let Some(ctx) = context {
            for (key, value) in ctx {
                report = report.with_context(key, value);
            }
        }

        reporter.report(report);

        // Persist to disk periodically
        if let Some(app_data_dir) = app.path().app_data_dir().ok() {
            let _ = reporter.persist_to_file(&app_data_dir);
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_error_reports(limit: Option<usize>) -> Result<Vec<ErrorReport>, CommandError> {
    if let Some(reporter) = ErrorReporter::global() {
        Ok(reporter.get_reports(limit))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn get_error_stats() -> Result<ErrorStats, CommandError> {
    if let Some(reporter) = ErrorReporter::global() {
        Ok(reporter.get_stats())
    } else {
        Ok(ErrorStats {
            total_errors: 0,
            by_category: std::collections::HashMap::new(),
            by_severity: std::collections::HashMap::new(),
        })
    }
}

#[tauri::command]
async fn export_error_reports(
    app: tauri::AppHandle,
    format: Option<String>,
) -> Result<String, CommandError> {
    let format_str = format.unwrap_or_else(|| "json".to_string());

    let content = if let Some(reporter) = ErrorReporter::global() {
        match format_str.to_lowercase().as_str() {
            "markdown" | "md" => reporter.export_to_markdown(),
            _ => reporter.export_to_json(),
        }
    } else {
        "{}".to_string()
    };

    // Also save to file
    if let Some(app_data_dir) = app.path().app_data_dir().ok() {
        let reports_dir = app_data_dir.join("reports");
        std::fs::create_dir_all(&reports_dir).ok();

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let extension = if format_str == "markdown" || format_str == "md" {
            "md"
        } else {
            "json"
        };
        let filename = format!("error_report_{}.{}", timestamp, extension);
        let filepath = reports_dir.join(&filename);

        std::fs::write(&filepath, &content)?;

        info!("Error report exported to: {:?}", filepath);
    }

    Ok(content)
}

#[tauri::command]
async fn clear_error_reports() -> Result<(), CommandError> {
    if let Some(reporter) = ErrorReporter::global() {
        reporter.clear();
    }
    info!("Error reports cleared");
    Ok(())
}

#[tauri::command]
async fn load_error_reports(app: tauri::AppHandle) -> Result<usize, CommandError> {
    if let Some(reporter) = ErrorReporter::global() {
        if let Some(app_data_dir) = app.path().app_data_dir().ok() {
            match reporter.load_from_file(&app_data_dir) {
                Ok(count) => {
                    info!("Loaded {} error reports from disk", count);
                    return Ok(count);
                }
                Err(e) => {
                    warn!("Failed to load error reports: {}", e);
                }
            }
        }
    }
    Ok(0)
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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            info!("Initializing application...");

            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            info!("App data directory: {:?}", app_data_dir);

            // Initialize error reporter early for crash handling
            let error_log_dir = app_data_dir.join("logs");
            ErrorReporter::init(error_log_dir);

            let db = Database::new(app_data_dir.clone()).expect("Failed to initialize database");
            app.manage(DbState(Arc::new(db)));

            // Initialize recorder state
            app.manage(RecorderState(Arc::new(Mutex::new(None))));

            // Initialize transcriber state
            app.manage(TranscriberState(Arc::new(Mutex::new(None))));

            // Initialize downloader
            let models_dir = app_data_dir.join("models");
            app.manage(DownloaderState(Arc::new(ModelDownloader::new(models_dir))));

            // Initialize license manager
            app.manage(LicenseManagerState(Arc::new(LicenseManager::new())));

            // Initialize text injector (reused for better performance)
            let text_injector = text_inject::TextInjector::new()
                .expect("Failed to initialize text injector");
            app.manage(TextInjectorState(Arc::new(Mutex::new(text_injector))));

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
            // Handle window close - minimize to tray or actually close based on setting
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Get the minimize_to_tray setting from database
                let should_minimize = window
                    .app_handle()
                    .try_state::<DbState>()
                    .and_then(|db| db.0.get_settings().ok())
                    .map(|settings| settings.minimize_to_tray)
                    .unwrap_or(true); // Default to minimize if can't read setting

                if should_minimize {
                    debug!("Window close requested, hiding to tray");
                    let _ = window.hide();
                    api.prevent_close();
                } else {
                    debug!("Window close requested, exiting app");
                    // Allow the close to proceed - app will exit
                }
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
            // Recording overlay
            show_recording_overlay,
            hide_recording_overlay,
            // Transcription
            load_model,
            unload_model,
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
            execute_keyboard_shortcut,
            // Post-processing
            post_process_text,
            // Transcription history
            add_transcription,
            get_transcription_history,
            get_transcription_history_count,
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
            get_device_info,
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
            // Error reporting
            report_error,
            get_error_reports,
            get_error_stats,
            export_error_reports,
            clear_error_reports,
            load_error_reports,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create tray menu items
    let show_item = MenuItem::with_id(app, "show", "Show WaveType", true, None::<&str>)?;
    let start_recording_item = MenuItem::with_id(
        app,
        "start_recording",
        "Start Recording",
        true,
        None::<&str>,
    )?;
    let stop_recording_item =
        MenuItem::with_id(app, "stop_recording", "Stop Recording", true, None::<&str>)?;
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
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("No default icon")?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("WaveType - Voice to Text")
        .on_menu_event(|app, event| match event.id().as_ref() {
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
