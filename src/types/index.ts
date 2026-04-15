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
  pushToTalkKey: "Alt+Shift+S",
  toggleKey: "Alt+Shift+D",
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

// Available transcription models
export const WHISPER_MODELS: WhisperModel[] = [
  // ========== RECOMMENDED ==========
  {
    id: "distil-medium.en",
    name: "Distil Whisper Medium English",
    size: "390 MB",
    sizeBytes: 390 * 1024 * 1024,
    description: "Recommended English model for fast, accurate dictation.",
    languages: ["en"],
    recommended: true,
  },

  // ========== STANDARD WHISPER (Multilingual) ==========
  {
    id: "tiny",
    name: "Whisper Tiny",
    size: "75 MB",
    sizeBytes: 75 * 1024 * 1024,
    description:
      "Fastest Whisper model. Best for quick notes and low-resource devices.",
    languages: ["en", "bn"],
  },
  {
    id: "base",
    name: "Whisper Base",
    size: "142 MB",
    sizeBytes: 142 * 1024 * 1024,
    description: "Balanced Whisper model for everyday transcription.",
    languages: ["en", "bn"],
  },
  {
    id: "small",
    name: "Whisper Small",
    size: "466 MB",
    sizeBytes: 466 * 1024 * 1024,
    description:
      "Improved accuracy for longer dictation, meetings, and focused writing.",
    languages: ["en", "bn"],
  },
  {
    id: "medium",
    name: "Whisper Medium",
    size: "1.5 GB",
    sizeBytes: 1.5 * 1024 * 1024 * 1024,
    description: "High-accuracy multilingual transcription for demanding audio.",
    languages: ["en", "bn"],
  },

  // ========== ENGLISH-ONLY (Faster) ==========
  {
    id: "tiny.en",
    name: "Whisper Tiny English",
    size: "75 MB",
    sizeBytes: 75 * 1024 * 1024,
    description: "Fastest English-only Whisper model. Great for quick notes.",
    languages: ["en"],
  },
  {
    id: "base.en",
    name: "Whisper Base English",
    size: "142 MB",
    sizeBytes: 142 * 1024 * 1024,
    description: "Fast English-only Whisper model with good accuracy.",
    languages: ["en"],
  },
  {
    id: "small.en",
    name: "Whisper Small English",
    size: "466 MB",
    sizeBytes: 466 * 1024 * 1024,
    description: "Accurate English-only Whisper model for longer dictation.",
    languages: ["en"],
  },
  {
    id: "medium.en",
    name: "Whisper Medium English",
    size: "1.5 GB",
    sizeBytes: 1.5 * 1024 * 1024 * 1024,
    description: "High-accuracy English-only Whisper model.",
    languages: ["en"],
  },

  // ========== DISTIL-WHISPER (Faster) ==========
  {
    id: "distil-small.en",
    name: "Distil Whisper Small English",
    size: "166 MB",
    sizeBytes: 166 * 1024 * 1024,
    description: "Fast English transcription with accuracy close to Whisper Small.",
    languages: ["en"],
  },
  {
    id: "distil-large-v2",
    name: "Distil Whisper Large v2",
    size: "756 MB",
    sizeBytes: 756 * 1024 * 1024,
    description: "Fast large English model with strong accuracy.",
    languages: ["en"],
  },
  {
    id: "distil-large-v3",
    name: "Distil Whisper Large v3",
    size: "756 MB",
    sizeBytes: 756 * 1024 * 1024,
    description:
      "Latest Distil Whisper model with excellent English transcription quality.",
    languages: ["en"],
  },

  // ========== LARGE MODELS (Best Accuracy) ==========
  {
    id: "large-v3",
    name: "Whisper Large v3",
    size: "2.9 GB",
    sizeBytes: 2.9 * 1024 * 1024 * 1024,
    description: "Highest-accuracy Whisper model for professional workflows.",
    languages: ["en", "bn"],
  },
  {
    id: "large-v3-turbo",
    name: "Whisper Large v3 Turbo",
    size: "1.6 GB",
    sizeBytes: 1.6 * 1024 * 1024 * 1024,
    description:
      "Fast large Whisper model with a strong speed and accuracy balance.",
    languages: ["en", "bn"],
  },
];

export const PARAKEET_MODELS: WhisperModel[] = [
  {
    id: "parakeet-v3",
    name: "Parakeet v3",
    size: "670 MB",
    sizeBytes: 670 * 1024 * 1024,
    description: "Fast Parakeet English model with excellent responsiveness.",
    languages: ["en"],
    recommended: true,
  },
  {
    id: "parakeet-v2",
    name: "Parakeet v2",
    size: "661 MB",
    sizeBytes: 661 * 1024 * 1024,
    description: "Previous Parakeet English model with stable transcription quality.",
    languages: ["en"],
  },
];

export const ALL_MODELS = [...WHISPER_MODELS, ...PARAKEET_MODELS];
