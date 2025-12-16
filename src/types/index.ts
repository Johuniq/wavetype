// WaveType - Type Definitions

// Available Whisper models for offline transcription
export interface WhisperModel {
  id: string;
  name: string;
  size: string; // e.g., "75 MB", "1.5 GB"
  sizeBytes: number;
  description: string;
  languages: string[];
  recommended?: boolean;
  downloaded?: boolean;
  downloadProgress?: number; // 0-100
}

// App settings
export interface AppSettings {
  // Hotkey configuration
  pushToTalkKey: string;
  toggleKey: string;
  hotkeyMode: "push-to-talk" | "toggle";

  // Language settings
  language: "en" | "bn"; // English or Bangla

  // Model settings
  selectedModelId: string;

  // UI preferences
  showRecordingIndicator: boolean;
  playAudioFeedback: boolean;

  // Advanced
  autoStartOnBoot: boolean;
  minimizeToTray: boolean;
}

// Recording state
export type RecordingStatus = "idle" | "recording" | "processing" | "error";

// Model download status
export type ModelStatus =
  | "not-downloaded"
  | "downloading"
  | "downloaded"
  | "loading"
  | "ready"
  | "error";

// App state
export interface AppState {
  // Setup flow
  isFirstLaunch: boolean;
  setupComplete: boolean;
  currentSetupStep: number;

  // Recording
  recordingStatus: RecordingStatus;
  lastTranscription: string;
  errorMessage: string | null;

  // Model
  modelStatus: ModelStatus;
  selectedModel: WhisperModel | null;
  downloadProgress: number;

  // Settings
  settings: AppSettings;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  pushToTalkKey: "Ctrl+Shift+R",
  toggleKey: "Ctrl+Shift+T",
  hotkeyMode: "push-to-talk",
  language: "en",
  selectedModelId: "base",
  showRecordingIndicator: true,
  playAudioFeedback: true,
  autoStartOnBoot: false,
  minimizeToTray: true,
};

// Available Whisper models
export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: "tiny",
    name: "Tiny",
    size: "75 MB",
    sizeBytes: 75 * 1024 * 1024,
    description: "Fastest model, lower accuracy. Good for quick notes.",
    languages: ["en"],
  },
  {
    id: "base",
    name: "Base",
    size: "142 MB",
    sizeBytes: 142 * 1024 * 1024,
    description: "Balanced speed and accuracy. Recommended for most users.",
    languages: ["en"],
    recommended: true,
  },
  {
    id: "small",
    name: "Small",
    size: "466 MB",
    sizeBytes: 466 * 1024 * 1024,
    description: "Better accuracy, moderate speed. Good for longer dictation.",
    languages: ["en", "bn"],
  },
  {
    id: "medium",
    name: "Medium",
    size: "1.5 GB",
    sizeBytes: 1.5 * 1024 * 1024 * 1024,
    description:
      "High accuracy, slower processing. Best for accuracy-critical work.",
    languages: ["en", "bn"],
  },
  {
    id: "large",
    name: "Large",
    size: "3 GB",
    sizeBytes: 3 * 1024 * 1024 * 1024,
    description:
      "Highest accuracy, requires powerful hardware. Professional use.",
    languages: ["en", "bn"],
  },
];
