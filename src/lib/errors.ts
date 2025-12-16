/**
 * User-friendly error messages for WaveType
 * Maps technical errors to actionable user messages
 */

export interface UserError {
  title: string;
  message: string;
  action?: string;
  actionLabel?: string;
  recoverable: boolean;
}

const ERROR_MAP: Record<string, UserError> = {
  // Recording errors
  "No input device available": {
    title: "No Microphone Found",
    message: "Please connect a microphone and try again.",
    recoverable: true,
  },
  "Already recording": {
    title: "Already Recording",
    message: "A recording is already in progress.",
    recoverable: true,
  },
  "No audio recorded": {
    title: "No Audio Captured",
    message: "No audio was captured. Please speak and try again.",
    recoverable: true,
  },
  "Failed to start recording": {
    title: "Recording Failed",
    message:
      "Could not start recording. Please check your microphone permissions.",
    recoverable: true,
  },

  // Transcription errors
  "No model loaded": {
    title: "Model Not Loaded",
    message: "The AI model is not loaded. Please wait or restart the app.",
    recoverable: true,
  },
  "Transcription failed": {
    title: "Transcription Failed",
    message: "Could not transcribe the audio. Please try again.",
    recoverable: true,
  },
  "Model file not found": {
    title: "Model Missing",
    message:
      "The AI model file is missing. Please download it again in Settings.",
    action: "settings",
    actionLabel: "Go to Settings",
    recoverable: true,
  },

  // Download errors
  "Download failed": {
    title: "Download Failed",
    message:
      "Could not download the model. Please check your internet connection.",
    recoverable: true,
  },
  "Network error": {
    title: "Network Error",
    message: "Please check your internet connection and try again.",
    recoverable: true,
  },

  // Hotkey errors
  "Invalid hotkey": {
    title: "Invalid Hotkey",
    message:
      "The hotkey combination is not valid. Please choose a different one.",
    recoverable: true,
  },
  "Hotkey already in use": {
    title: "Hotkey Conflict",
    message: "This hotkey is already used by another application.",
    recoverable: true,
  },

  // Text injection errors
  "Failed to inject text": {
    title: "Could Not Insert Text",
    message:
      "Could not insert text at cursor. Please make sure a text field is focused.",
    recoverable: true,
  },

  // Database errors
  "Database error": {
    title: "Storage Error",
    message:
      "Could not save data. The app will continue working but changes may not persist.",
    recoverable: true,
  },

  // File errors
  "File not found": {
    title: "File Not Found",
    message: "The selected file could not be found.",
    recoverable: true,
  },
  "Invalid WAV file": {
    title: "Invalid Audio File",
    message: "The file format is not supported. Please use a WAV file.",
    recoverable: true,
  },
};

/**
 * Parse an error and return a user-friendly message
 */
export function parseError(error: unknown): UserError {
  const errorString = error instanceof Error ? error.message : String(error);

  // Check for exact matches
  if (ERROR_MAP[errorString]) {
    return ERROR_MAP[errorString];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (errorString.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Default error
  return {
    title: "Something Went Wrong",
    message: errorString || "An unexpected error occurred. Please try again.",
    recoverable: true,
  };
}

/**
 * Get a simple error message string
 */
export function getErrorMessage(error: unknown): string {
  const userError = parseError(error);
  return userError.message;
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  return parseError(error).recoverable;
}
