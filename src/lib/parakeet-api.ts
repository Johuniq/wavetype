import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ParakeetCommand {
  type: "load_model" | "download_model" | "unload_model" | "transcribe" | "status" | "shutdown" | "delete_model";
  model_version?: "v2" | "v3";
  audio_path?: string;
  force_download?: boolean;
}

export interface ParakeetResponse {
  type: "transcription" | "status" | "error";
  text?: string;
  loaded_model?: string;
  model_version?: string;
  code?: string;
  message?: string;
  duration?: number;
}

/**
 * Starts the Parakeet sidecar process.
 * This should be called once when the app starts or when the user enables Parakeet.
 */
export async function startParakeet(): Promise<void> {
  try {
    await invoke("start_parakeet");
    console.log("Parakeet sidecar started");
  } catch (error) {
    console.error("Failed to start Parakeet sidecar:", error);
    throw error;
  }
}

/**
 * Sends a command to the Parakeet sidecar.
 */
export async function sendParakeetCommand(command: ParakeetCommand): Promise<void> {
  try {
    await invoke("send_parakeet_command", { command });
  } catch (error) {
    console.error("Failed to send Parakeet command:", error);
    throw error;
  }
}

/**
 * Listens for responses from the Parakeet sidecar.
 */
export async function onParakeetResponse(callback: (response: ParakeetResponse) => void) {
  return await listen<ParakeetResponse>("parakeet-response", (event) => {
    callback(event.payload);
  });
}

/**
 * Helper to load a specific Parakeet model version.
 */
export async function loadParakeetModel(version: "v2" | "v3" = "v3", download: boolean = false): Promise<void> {
  await sendParakeetCommand({
    type: download ? "download_model" : "load_model",
    model_version: version,
  });
}

/**
 * Helper to transcribe an audio file using Parakeet.
 */
export async function transcribeWithParakeet(audioPath: string): Promise<void> {
  await sendParakeetCommand({
    type: "transcribe",
    audio_path: audioPath,
  });
}
