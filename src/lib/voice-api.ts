/**
 * Voice API - Recording, Transcription, and Text Injection
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ============================================
// Types
// ============================================

export interface DownloadProgress {
  model_id: string;
  bytes_downloaded: number;
  total_bytes: number;
  percentage: number;
}

// ============================================
// Recording API
// ============================================

export async function startRecording(): Promise<void> {
  await invoke("start_recording");
}

export async function stopRecording(): Promise<number[]> {
  return await invoke<number[]>("stop_recording");
}

export async function cancelRecording(): Promise<void> {
  await invoke("cancel_recording");
}

export async function isRecording(): Promise<boolean> {
  return await invoke<boolean>("is_recording");
}

// ============================================
// Transcription API
// ============================================

export async function loadModel(
  modelId: string,
  language: string = "en"
): Promise<void> {
  await invoke("load_model", { modelId, language });
}

export async function transcribeAudio(audioSamples: number[]): Promise<string> {
  return await invoke<string>("transcribe_audio", { audioSamples });
}

export async function recordAndTranscribe(): Promise<string> {
  return await invoke<string>("record_and_transcribe");
}

export async function transcribeFile(filePath: string): Promise<string> {
  return await invoke<string>("transcribe_file", { filePath });
}

// ============================================
// Model Download API
// ============================================

export async function downloadModel(modelId: string): Promise<string> {
  return await invoke<string>("download_model", { modelId });
}

export async function deleteModel(modelId: string): Promise<void> {
  await invoke("delete_model", { modelId });
}

export async function isModelDownloaded(modelId: string): Promise<boolean> {
  return await invoke<boolean>("is_model_downloaded", { modelId });
}

export async function getDownloadedModels(): Promise<string[]> {
  return await invoke<string[]>("get_downloaded_models");
}

export async function getModelPath(modelId: string): Promise<string> {
  return await invoke<string>("get_model_path", { modelId });
}

export async function getModelsDir(): Promise<string> {
  return await invoke<string>("get_models_dir");
}

// ============================================
// Download Progress Listener
// ============================================

export async function onDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return await listen<DownloadProgress>("download-progress", (event) => {
    callback(event.payload);
  });
}

// ============================================
// Text Injection API
// ============================================

export async function injectText(text: string): Promise<void> {
  await invoke("inject_text", { text });
}

// ============================================
// High-Level Voice-to-Text Function
// ============================================

export interface VoiceToTextOptions {
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onTranscriptionStart?: () => void;
  onTranscriptionComplete?: (text: string) => void;
  onError?: (error: string) => void;
  injectToActiveWindow?: boolean;
}

/**
 * Complete voice-to-text flow:
 * 1. Stop recording
 * 2. Transcribe audio
 * 3. Optionally inject text to active cursor
 */
export async function completeVoiceToText(
  options: VoiceToTextOptions = {}
): Promise<string | null> {
  try {
    options.onRecordingStop?.();
    options.onTranscriptionStart?.();

    // Stop recording and transcribe
    const text = await recordAndTranscribe();

    options.onTranscriptionComplete?.(text);

    // Inject text if requested
    if (options.injectToActiveWindow && text) {
      await injectText(text);
    }

    return text;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    options.onError?.(errorMessage);
    return null;
  }
}

/**
 * Start a voice recording session
 */
export async function startVoiceRecording(
  onStart?: () => void
): Promise<boolean> {
  try {
    await startRecording();
    onStart?.();
    return true;
  } catch (error) {
    console.error("Failed to start recording:", error);
    return false;
  }
}

/**
 * Stop recording and get transcription
 */
export async function stopAndTranscribe(): Promise<string | null> {
  try {
    return await recordAndTranscribe();
  } catch (error) {
    console.error("Failed to transcribe:", error);
    return null;
  }
}

/**
 * Stop recording, transcribe, and inject text
 */
export async function stopTranscribeAndInject(): Promise<string | null> {
  try {
    const text = await recordAndTranscribe();
    if (text) {
      await injectText(text);
    }
    return text;
  } catch (error) {
    console.error("Failed to transcribe and inject:", error);
    return null;
  }
}

// ============================================
// Hotkey API
// ============================================

export async function registerHotkey(hotkey: string): Promise<void> {
  await invoke("register_hotkey", { hotkey });
}

export async function unregisterHotkeys(): Promise<void> {
  await invoke("unregister_hotkeys");
}

export async function onHotkeyPressed(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("hotkey-pressed", () => {
    callback();
  });
}

export async function onHotkeyReleased(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("hotkey-released", () => {
    callback();
  });
}

// ============================================
// Tray Events
// ============================================

export async function onTrayStartRecording(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("tray-start-recording", () => {
    callback();
  });
}

export async function onTrayStopRecording(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("tray-stop-recording", () => {
    callback();
  });
}

// ============================================
// History API
// ============================================

export interface TranscriptionHistoryItem {
  id: number;
  text: string;
  model_id: string;
  language: string;
  duration_ms: number;
  created_at: string;
}

export async function getTranscriptionHistory(
  limit?: number
): Promise<TranscriptionHistoryItem[]> {
  return await invoke<TranscriptionHistoryItem[]>("get_transcription_history", {
    limit,
  });
}

export async function addTranscription(
  text: string,
  modelId: string,
  language: string,
  durationMs: number
): Promise<number> {
  return await invoke<number>("add_transcription", {
    text,
    model_id: modelId,
    language,
    duration_ms: durationMs,
  });
}

export async function clearTranscriptionHistory(): Promise<void> {
  await invoke("clear_transcription_history");
}

export async function deleteTranscriptionItem(id: number): Promise<void> {
  await invoke("delete_transcription", { id });
}
