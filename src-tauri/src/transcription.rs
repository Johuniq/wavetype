use std::path::Path;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct Transcriber {
    ctx: WhisperContext,
    language: String,
}

impl Transcriber {
    pub fn new(model_path: &str, language: &str) -> Result<Self, String> {
        if !Path::new(model_path).exists() {
            return Err(format!("Model file not found: {}", model_path));
        }

        // Configure context parameters for maximum speed
        let mut ctx_params = WhisperContextParameters::default();
        
        // Enable flash attention for faster inference (CPU-only optimization)
        // Flash attention reduces memory bandwidth and speeds up attention computation
        ctx_params.flash_attn(true);
        
        // GPU is handled via compile-time features (metal on macOS, cuda/vulkan on others)
        // The default will use GPU if the feature is enabled
        
        let ctx = WhisperContext::new_with_params(model_path, ctx_params)
            .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

        Ok(Self {
            ctx,
            language: language.to_string(),
        })
    }

    pub fn transcribe(&self, audio_samples: &[f32]) -> Result<String, String> {
        if audio_samples.is_empty() {
            return Err("No audio samples to transcribe".to_string());
        }

        // Use Greedy decoding for fastest results
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        // Set language (empty string = auto-detect)
        if !self.language.is_empty() && self.language != "auto" {
            params.set_language(Some(&self.language));
        }

        // Disable translation, we want transcription
        params.set_translate(false);

        // ========== AGGRESSIVE SPEED OPTIMIZATIONS ==========

        // Single segment mode - fastest for voice input (< 30 seconds)
        params.set_single_segment(true);

        // Disable ALL output printing for maximum speed
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_print_special(false);

        // Disable ALL timestamps - not needed for text output
        params.set_token_timestamps(false);
        params.set_no_timestamps(true);

        // Disable context - each utterance is independent
        params.set_no_context(true);

        // Suppress non-speech tokens for cleaner, faster output
        params.set_suppress_blank(true);
        params.set_suppress_non_speech_tokens(true);

        // Reduced max tokens - voice input is typically short
        params.set_max_tokens(64);

        // Audio context 0 = use default from model (fastest)
        params.set_audio_ctx(0);

        // Use all available CPU cores for parallel inference
        let num_threads = std::thread::available_parallelism()
            .map(|p| p.get() as i32)
            .unwrap_or(4);
        params.set_n_threads(num_threads);

        // Higher entropy threshold = faster decoding, slightly less accuracy
        params.set_entropy_thold(2.8);

        // Temperature 0 = greedy decoding (fastest, deterministic)
        params.set_temperature(0.0);

        // Disable beam search fallback - stick with greedy for speed
        params.set_temperature_inc(0.0);

        // Speed penalty - prefer shorter sequences (faster decoding)
        params.set_length_penalty(1.0);

        // Create state for this transcription
        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

        // Run inference
        state
            .full(params, audio_samples)
            .map_err(|e| format!("Transcription failed: {}", e))?;

        // Collect all segments efficiently
        let num_segments = state
            .full_n_segments()
            .map_err(|e| format!("Failed to get segments: {}", e))?;

        // Pre-allocate string capacity for typical transcription length
        // Average word is ~5 chars, so 128 chars is a reasonable estimate
        let mut result = String::with_capacity((num_segments as usize).saturating_mul(128));
        for i in 0..num_segments {
            if let Ok(segment) = state.full_get_segment_text(i) {
                if !segment.trim().is_empty() {
                    if !result.is_empty() {
                        result.push(' ');
                    }
                    result.push_str(&segment);
                }
            }
        }

        Ok(result)
    }

    pub fn set_language(&mut self, language: &str) {
        self.language = language.to_string();
    }
}

// Model download URLs (Hugging Face)
pub fn get_model_url(model_id: &str) -> Option<String> {
    let base = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
    let distil_base = "https://huggingface.co/distil-whisper";

    match model_id {
        // Standard Whisper models (multilingual)
        "tiny" => Some(format!("{}/ggml-tiny.bin", base)),
        "base" => Some(format!("{}/ggml-base.bin", base)),
        "small" => Some(format!("{}/ggml-small.bin", base)),
        "medium" => Some(format!("{}/ggml-medium.bin", base)),
        "large-v2" => Some(format!("{}/ggml-large-v2.bin", base)),
        "large-v3" => Some(format!("{}/ggml-large-v3.bin", base)),
        "large-v3-turbo" => Some(format!("{}/ggml-large-v3-turbo.bin", base)),

        // English-only Whisper models (faster, optimized for English)
        "tiny.en" => Some(format!("{}/ggml-tiny.en.bin", base)),
        "base.en" => Some(format!("{}/ggml-base.en.bin", base)),
        "small.en" => Some(format!("{}/ggml-small.en.bin", base)),
        "medium.en" => Some(format!("{}/ggml-medium.en.bin", base)),

        // Distil-Whisper models (6x faster, similar accuracy)
        "distil-small.en" => Some(format!(
            "{}/distil-small.en/resolve/main/ggml-distil-small.en.bin",
            distil_base
        )),
        "distil-medium.en" => Some(format!(
            "{}/distil-medium.en/resolve/main/ggml-distil-medium.en.bin",
            distil_base
        )),
        "distil-large-v2" => Some(format!(
            "{}/distil-large-v2/resolve/main/ggml-distil-large-v2.bin",
            distil_base
        )),
        "distil-large-v3" => Some(format!(
            "{}/distil-large-v3/resolve/main/ggml-distil-large-v3.bin",
            distil_base
        )),

        // Legacy (for backwards compatibility)
        "large" => Some(format!("{}/ggml-large-v3.bin", base)),

        _ => None,
    }
}

pub fn get_model_filename(model_id: &str) -> String {
    match model_id {
        // Distil models have different naming
        "distil-small.en" => "ggml-distil-small.en.bin".to_string(),
        "distil-medium.en" => "ggml-distil-medium.en.bin".to_string(),
        "distil-large-v2" => "ggml-distil-large-v2.bin".to_string(),
        "distil-large-v3" => "ggml-distil-large-v3.bin".to_string(),
        // English-only models
        "tiny.en" => "ggml-tiny.en.bin".to_string(),
        "base.en" => "ggml-base.en.bin".to_string(),
        "small.en" => "ggml-small.en.bin".to_string(),
        "medium.en" => "ggml-medium.en.bin".to_string(),
        // Standard models
        _ => format!("ggml-{}.bin", model_id),
    }
}
