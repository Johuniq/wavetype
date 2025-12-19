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
  showRecordingOverlay: boolean; // Show fullscreen wave overlay when recording

  // Post-processing
  postProcessingEnabled: boolean;

  // Output mode
  clipboardMode: boolean; // true = copy to clipboard, false = inject text

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

// License status
export type LicenseStatus =
  | "active"
  | "inactive"
  | "expired"
  | "revoked"
  | "disabled"
  | "invalid"
  | "not_activated"
  | "activation_limit";

// License data
export interface LicenseData {
  licenseKey: string | null;
  activationId: string | null;
  status: LicenseStatus;
  customerEmail: string | null;
  customerName: string | null;
  expiresAt: string | null;
  isActivated: boolean;
  lastValidatedAt: string | null;
}

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
  showRecordingOverlay: true,
  postProcessingEnabled: true,
  clipboardMode: false,
  autoStartOnBoot: false,
  minimizeToTray: true,
};

// Model categories for UI grouping
export type ModelCategory = "standard" | "english" | "distil" | "large";

// Transcription engine types
export type TranscriptionEngine = "whisper";

// Available Whisper models
export const WHISPER_MODELS: WhisperModel[] = [
  // ========== RECOMMENDED ==========
  {
    id: "distil-medium.en",
    name: "⚡ Distil Medium",
    size: "390 MB",
    sizeBytes: 390 * 1024 * 1024,
    description:
      "6x faster than Medium with similar accuracy. Best for real-time use.",
    languages: ["en"],
    recommended: true,
  },

  // ========== STANDARD WHISPER (Multilingual) ==========
  {
    id: "tiny",
    name: "Tiny",
    size: "75 MB",
    sizeBytes: 75 * 1024 * 1024,
    description: "Fastest multilingual model. Good for quick notes.",
    languages: ["en", "bn"],
  },
  {
    id: "base",
    name: "Base",
    size: "142 MB",
    sizeBytes: 142 * 1024 * 1024,
    description: "Balanced speed and accuracy. Good starting point.",
    languages: ["en", "bn"],
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
    description: "High accuracy multilingual. Best for accuracy-critical work.",
    languages: ["en", "bn"],
  },

  // ========== ENGLISH-ONLY (Faster) ==========
  {
    id: "tiny.en",
    name: "Tiny English",
    size: "75 MB",
    sizeBytes: 75 * 1024 * 1024,
    description: "Fastest English-only. Great for quick notes.",
    languages: ["en"],
  },
  {
    id: "base.en",
    name: "Base English",
    size: "142 MB",
    sizeBytes: 142 * 1024 * 1024,
    description: "Fast English-only with good accuracy.",
    languages: ["en"],
  },
  {
    id: "small.en",
    name: "Small English",
    size: "466 MB",
    sizeBytes: 466 * 1024 * 1024,
    description: "Accurate English-only model.",
    languages: ["en"],
  },
  {
    id: "medium.en",
    name: "Medium English",
    size: "1.5 GB",
    sizeBytes: 1.5 * 1024 * 1024 * 1024,
    description: "High accuracy English-only.",
    languages: ["en"],
  },

  // ========== DISTIL-WHISPER (6x Faster) ==========
  {
    id: "distil-small.en",
    name: "⚡ Distil Small",
    size: "166 MB",
    sizeBytes: 166 * 1024 * 1024,
    description: "6x faster than Small. Great for real-time transcription.",
    languages: ["en"],
  },
  {
    id: "distil-large-v2",
    name: "⚡ Distil Large v2",
    size: "756 MB",
    sizeBytes: 756 * 1024 * 1024,
    description: "Fast large model with near-equal accuracy.",
    languages: ["en"],
  },
  {
    id: "distil-large-v3",
    name: "⚡ Distil Large v3",
    size: "756 MB",
    sizeBytes: 756 * 1024 * 1024,
    description: "Latest distilled model. Excellent performance.",
    languages: ["en"],
  },

  // ========== LARGE MODELS (Best Accuracy) ==========
  {
    id: "large-v3",
    name: "Large v3",
    size: "2.9 GB",
    sizeBytes: 2.9 * 1024 * 1024 * 1024,
    description: "Highest accuracy multilingual. Professional use.",
    languages: ["en", "bn"],
  },
  {
    id: "large-v3-turbo",
    name: "Large v3 Turbo",
    size: "1.6 GB",
    sizeBytes: 1.6 * 1024 * 1024 * 1024,
    description: "Fast large model. Great speed/accuracy balance.",
    languages: ["en", "bn"],
  },
];
