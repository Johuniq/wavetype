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

        let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
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
        
        // ========== SPEED OPTIMIZATIONS ==========
        
        // Single segment mode for short recordings (< 30 seconds)
        // This is faster for voice input which is typically short
        params.set_single_segment(true);
        
        // Disable all printing for speed
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_print_special(false);
        
        // Disable token timestamps (not needed for text output)
        params.set_token_timestamps(false);
        
        // Suppress non-speech tokens for cleaner output
        params.set_suppress_blank(true);
        params.set_suppress_non_speech_tokens(true);
        
        // Reduce max tokens for faster processing (typical sentence)
        params.set_max_tokens(128);
        
        // Set audio context to 0 for faster processing
        // (uses default context from model)
        params.set_audio_ctx(0);
        
        // Use 1 thread for CPU (can adjust based on system)
        // Using fewer threads can sometimes be faster for short audio
        params.set_n_threads(4);

        // Create state for this transcription
        let mut state = self.ctx.create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

        // Run inference
        state.full(params, audio_samples)
            .map_err(|e| format!("Transcription failed: {}", e))?;

        // Collect all segments
        let num_segments = state.full_n_segments()
            .map_err(|e| format!("Failed to get segments: {}", e))?;

        let mut result = String::new();
        for i in 0..num_segments {
            if let Ok(segment) = state.full_get_segment_text(i) {
                result.push_str(&segment);
                result.push(' ');
            }
        }

        Ok(result.trim().to_string())
    }

    pub fn set_language(&mut self, language: &str) {
        self.language = language.to_string();
    }
}

// Model download URLs (Hugging Face)
pub fn get_model_url(model_id: &str) -> Option<String> {
    let base = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
    
    match model_id {
        "tiny" => Some(format!("{}/ggml-tiny.bin", base)),
        "base" => Some(format!("{}/ggml-base.bin", base)),
        "small" => Some(format!("{}/ggml-small.bin", base)),
        "medium" => Some(format!("{}/ggml-medium.bin", base)),
        "large" => Some(format!("{}/ggml-large-v3.bin", base)),
        _ => None,
    }
}

pub fn get_model_filename(model_id: &str) -> String {
    format!("ggml-{}.bin", model_id)
}
