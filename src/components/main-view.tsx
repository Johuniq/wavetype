import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { playFeedbackSound } from "@/lib/preferences-api";
import { cn } from "@/lib/utils";
import {
  addTranscription,
  setAudioCaptureConfig,
  hideRecordingOverlay,
  loadModel,
  onHotkeyPressed,
  onHotkeyReleased,
  onTrayNavigate,
  onTrayStartRecording,
  onTrayStopRecording,
  registerHotkey,
  showRecordingOverlay,
  startRecording,
  stopTranscribeAndInject,
  unregisterHotkeys,
} from "@/lib/voice-api";
import { useAppStore } from "@/store";
import type { RecordingStatus } from "@/types";
import {
  AlertCircle,
  Clock,
  Cpu,
  FileAudio,
  HelpCircle,
  History,
  Key,
  Loader2,
  Menu,
  Mic,
  Settings,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Lazy load heavy views to reduce initial bundle and memory
const HistoryView = lazy(() =>
  import("@/components/history-view").then((m) => ({ default: m.HistoryView })),
);
const HelpSupportView = lazy(() =>
  import("@/components/help-support-view").then((m) => ({
    default: m.HelpSupportView,
  })),
);
const LicenseView = lazy(() =>
  import("@/components/license-view").then((m) => ({ default: m.LicenseView })),
);
const ModelsView = lazy(() =>
  import("@/components/models-view").then((m) => ({ default: m.ModelsView })),
);
const SettingsView = lazy(() =>
  import("@/components/settings-view").then((m) => ({
    default: m.SettingsView,
  })),
);
const TranscribeView = lazy(() =>
  import("@/components/transcribe-view").then((m) => ({
    default: m.TranscribeView,
  })),
);

// Global flags to prevent duplicate listeners and calls
let hotkeyListenersSetup = false;
let lastHotkeyPressTime = 0;
const HOTKEY_DEBOUNCE_MS = 100;

interface MainViewProps {
  trialDaysRemaining?: number;
}

export function MainView({ trialDaysRemaining }: MainViewProps) {
  const {
    recordingStatus,
    setRecordingStatus,
    lastTranscription,
    setLastTranscription,
    settings,
    selectedModel,
    errorMessage,
    setErrorMessage,
  } = useAppStore();

  const { success: toastSuccess, error: toastError } = useToast();

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [showHelpSupport, setShowHelpSupport] = useState(false);

  // Refs to track recording state for hotkey handlers
  const recordingStatusRef = useRef(recordingStatus);
  const isModelLoadedRef = useRef(isModelLoaded);
  const hotkeyModeRef = useRef(settings.hotkeyMode);
  const settingsRef = useRef(settings);

  // Keep refs in sync with state
  useEffect(() => {
    recordingStatusRef.current = recordingStatus;
  }, [recordingStatus]);

  useEffect(() => {
    isModelLoadedRef.current = isModelLoaded;
  }, [isModelLoaded]);

  useEffect(() => {
    hotkeyModeRef.current = settings.hotkeyMode;
  }, [settings.hotkeyMode]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setIsModelLoaded(false);
  }, [selectedModel?.id, selectedModel?.downloaded, settings.language]);

  const currentHotkey =
    settings.hotkeyMode === "push-to-talk"
      ? settings.pushToTalkKey
      : settings.toggleKey;

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Something went wrong. Please try again.";
  };

  // Load the model on mount
  useEffect(() => {
    if (
      selectedModel?.downloaded &&
      !isModelLoaded &&
      !isLoadingModel
    ) {
      setIsLoadingModel(true);
      setErrorMessage(null);
      loadModel(selectedModel.id, settings.language)
        .then(() => {
          setIsModelLoaded(true);
          setIsLoadingModel(false);
          console.log("Model loaded:", selectedModel.id);
        })
        .catch((error) => {
          console.error("Failed to load model:", error);
          const message = getErrorMessage(error);
          setIsLoadingModel(false);
          setIsModelLoaded(false);
          setErrorMessage(
            message.toLowerCase().includes("not downloaded") ||
              message.toLowerCase().includes("not found")
              ? "Model files are missing. Download the model again."
              : "Failed to load AI model"
          );
        });
    }
  }, [
    selectedModel,
    isModelLoaded,
    isLoadingModel,
    settings.language,
    setErrorMessage,
  ]);

  // Handle starting recording
  const handleStartRecording = useCallback(async () => {
    if (!isModelLoadedRef.current) {
      setErrorMessage("Model not loaded yet");
      return;
    }

    if (recordingStatusRef.current !== "idle") {
      console.log("Already recording or processing, skipping");
      return;
    }

    // Set status IMMEDIATELY to prevent duplicate calls
    recordingStatusRef.current = "recording";
    setRecordingStatus("recording");

    try {
      setErrorMessage(null);

      // Main hotkey dictation should always use microphone capture.
      await setAudioCaptureConfig("mic", null, null);

      // Play audio feedback if enabled
      if (settingsRef.current.playAudioFeedback) {
        playFeedbackSound("start");
      }

      // Show recording overlay if enabled
      if (settingsRef.current.showRecordingOverlay !== false) {
        showRecordingOverlay().catch(console.error);
      }

      await startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setErrorMessage("Failed to start recording");
      recordingStatusRef.current = "error";
      setRecordingStatus("error");
      // Hide overlay on error
      hideRecordingOverlay().catch(console.error);
    }
  }, [setErrorMessage, setRecordingStatus]);

  // Handle stopping recording
  const handleStopRecording = useCallback(async () => {
    if (recordingStatusRef.current !== "recording") {
      console.log("Not recording, skipping stop");
      return;
    }

    // Set status IMMEDIATELY to prevent duplicate calls
    recordingStatusRef.current = "processing";
    setRecordingStatus("processing");

    // Hide recording overlay immediately when stopping
    hideRecordingOverlay().catch(console.error);

    // Get current settings from ref to avoid stale closures
    const currentSettings = settingsRef.current;

    // Play audio feedback if enabled
    if (currentSettings.playAudioFeedback) {
      playFeedbackSound("stop");
    }

    try {
      const startTime = Date.now();
      const text = await stopTranscribeAndInject(
        currentSettings.postProcessingEnabled,
        currentSettings.clipboardMode,
        selectedModel?.id,
        currentSettings.voiceCommandsEnabled,
      );
      const durationMs = Date.now() - startTime;

      // Update UI immediately
      recordingStatusRef.current = "idle";
      setRecordingStatus("idle");

      if (text) {
        setLastTranscription(text);
        const actionText = currentSettings.clipboardMode
          ? "Copied to clipboard"
          : "Transcribed and injected";
        toastSuccess(actionText);

        // Save to history in background (non-blocking)
        // Don't await - let it happen asynchronously so it doesn't slow down the response
        addTranscription(
          text,
          selectedModel?.id || "base",
          currentSettings.language,
          durationMs,
        )
          .then((insertedId) => {
            console.log("Saved transcription id:", insertedId);
          })
          .catch((historyError: any) => {
            console.error("Failed to save to history:", historyError);
            // Don't show error toast for background history saving failures
          });
      }
    } catch (error) {
      console.error("Transcription failed:", error);
      setErrorMessage("Transcription failed");
      recordingStatusRef.current = "error";
      setRecordingStatus("error");
      setTimeout(() => {
        recordingStatusRef.current = "idle";
        setRecordingStatus("idle");
      }, 2000);
    }
  }, [
    setRecordingStatus,
    setLastTranscription,
    setErrorMessage,
    selectedModel?.id,
    toastSuccess,
    toastError,
  ]);

  // Register hotkey on mount and when hotkey settings change
  useEffect(() => {
    let isMounted = true;

    const setupHotkey = async () => {
      try {
        // Unregister any existing hotkeys first
        await unregisterHotkeys();

        if (isMounted) {
          await registerHotkey(currentHotkey);
          console.log("Hotkey registered:", currentHotkey);
        }
      } catch (error) {
        console.error("Failed to register hotkey:", error);
      }
    };

    setupHotkey();

    return () => {
      isMounted = false;
      // Cleanup: unregister hotkeys when component unmounts
      unregisterHotkeys().catch(console.error);
    };
  }, [currentHotkey]);

  // Handle hotkey events
  useEffect(() => {
    // Prevent duplicate listeners in Strict Mode
    if (hotkeyListenersSetup) {
      console.log("Hotkey listeners already setup, skipping");
      return;
    }

    let unlistenPressed: (() => void) | null = null;
    let unlistenReleased: (() => void) | null = null;

    const setupListeners = async () => {
      hotkeyListenersSetup = true;

      // Handle hotkey pressed
      unlistenPressed = await onHotkeyPressed(() => {
        // Debounce to prevent duplicate calls from multiple listeners
        const now = Date.now();
        if (now - lastHotkeyPressTime < HOTKEY_DEBOUNCE_MS) {
          console.log("Hotkey press debounced");
          return;
        }
        lastHotkeyPressTime = now;

        const currentMode = hotkeyModeRef.current;
        console.log("Hotkey pressed, mode:", currentMode);
        if (currentMode === "push-to-talk") {
          // Start recording on key press
          handleStartRecording();
        } else {
          // Toggle mode - toggle recording
          if (recordingStatusRef.current === "idle") {
            handleStartRecording();
          } else if (recordingStatusRef.current === "recording") {
            handleStopRecording();
          }
        }
      });

      // Handle hotkey released
      unlistenReleased = await onHotkeyReleased(() => {
        const currentMode = hotkeyModeRef.current;
        console.log("Hotkey released, mode:", currentMode);
        if (currentMode === "push-to-talk") {
          // Stop recording on key release
          handleStopRecording();
        }
        // In toggle mode, release does nothing
      });
    };

    setupListeners();

    return () => {
      hotkeyListenersSetup = false;
      unlistenPressed?.();
      unlistenReleased?.();
    };
  }, [handleStartRecording, handleStopRecording]);

  // Handle tray events
  useEffect(() => {
    let unlistenStart: (() => void) | null = null;
    let unlistenStop: (() => void) | null = null;
    let unlistenNavigate: (() => void) | null = null;

    const setupTrayListeners = async () => {
      unlistenStart = await onTrayStartRecording(() => {
        handleStartRecording();
      });

      unlistenStop = await onTrayStopRecording(() => {
        handleStopRecording();
      });

      unlistenNavigate = await onTrayNavigate((target) => {
        setShowSettings(false);
        setShowModels(false);
        setShowHistory(false);
        setShowTranscribe(false);
        setShowLicense(false);
        setShowHelpSupport(false);

        if (target === "transcribe") setShowTranscribe(true);
        if (target === "history") setShowHistory(true);
        if (target === "models") setShowModels(true);
        if (target === "settings") setShowSettings(true);
        if (target === "help") setShowHelpSupport(true);
      });
    };

    setupTrayListeners();

    return () => {
      unlistenStart?.();
      unlistenStop?.();
      unlistenNavigate?.();
    };
  }, [handleStartRecording, handleStopRecording]);

  const toggleRecording = useCallback(async () => {
    if (!isModelLoaded) {
      setErrorMessage("Model not loaded yet");
      return;
    }

    if (recordingStatus === "idle") {
      // Start recording
      await handleStartRecording();
    } else if (recordingStatus === "recording") {
      // Stop recording and transcribe
      await handleStopRecording();
    }
  }, [
    isModelLoaded,
    recordingStatus,
    setErrorMessage,
    handleStartRecording,
    handleStopRecording,
  ]);

  // Memoize status config to prevent recreation on every render
  const statusConfig = useMemo<
    Record<
      RecordingStatus,
      {
        bgClass: string;
        iconClass: string;
        label: string;
      }
    >
  >(
    () => ({
      idle: {
        bgClass: "bg-muted hover:bg-muted/80",
        iconClass: "text-muted-foreground",
        label: "Ready",
      },
      recording: {
        bgClass: "bg-destructive",
        iconClass: "text-destructive-foreground",
        label: "Recording...",
      },
      processing: {
        bgClass: "bg-primary",
        iconClass: "text-primary-foreground",
        label: "Processing...",
      },
      error: {
        bgClass: "bg-destructive",
        iconClass: "text-destructive-foreground",
        label: "Error",
      },
    }),
    [],
  );

  const config = statusConfig[recordingStatus];

  // Loading fallback for lazy-loaded views
  const ViewLoadingFallback = useMemo(
    () => (
      <div className="relative flex flex-col h-full items-center justify-center overflow-hidden">
        <div className="glass-mesh-bg" />
        <div className="glass-card p-8 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
          <p className="mt-4 text-sm text-foreground/60">Loading...</p>
        </div>
      </div>
    ),
    [],
  );

  // Show settings view
  if (showSettings) {
    return (
      <Suspense fallback={ViewLoadingFallback}>
        <SettingsView onClose={() => setShowSettings(false)} />
      </Suspense>
    );
  }

  // Show models view
  if (showModels) {
    return (
      <Suspense fallback={ViewLoadingFallback}>
        <ModelsView onClose={() => setShowModels(false)} />
      </Suspense>
    );
  }

  // Show history view
  if (showHistory) {
    return (
      <Suspense fallback={ViewLoadingFallback}>
        <HistoryView onClose={() => setShowHistory(false)} />
      </Suspense>
    );
  }

  // Show transcribe view
  if (showTranscribe) {
    return (
      <Suspense fallback={ViewLoadingFallback}>
        <TranscribeView onClose={() => setShowTranscribe(false)} />
      </Suspense>
    );
  }

  // Show license view
  if (showLicense) {
    return (
      <Suspense fallback={ViewLoadingFallback}>
        <LicenseView onClose={() => setShowLicense(false)} />
      </Suspense>
    );
  }

  // Show help and support view
  if (showHelpSupport) {
    return (
      <Suspense fallback={ViewLoadingFallback}>
        <HelpSupportView onClose={() => setShowHelpSupport(false)} />
      </Suspense>
    );
  }

  // Show loading state while model is loading
  if (selectedModel?.downloaded && isLoadingModel) {
    return (
      <div className="relative flex flex-col h-full items-center justify-center overflow-hidden">
        {/* Background mesh gradient */}
        <div className="glass-mesh-bg" />

        <div className="glass-card p-8 flex flex-col items-center">
          <div className="glass-orb h-20 w-20 flex items-center justify-center glass-float">
            <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
          </div>
          <p className="mt-6 text-sm font-medium text-foreground/80">
            Loading AI model...
          </p>
          <p className="text-xs text-foreground/60 mt-1">
            {selectedModel?.name || "Base"} model
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      {/* Full-screen speaking animation overlay */}
      {/* <SpeakingOverlay
        visible={
          settings.showRecordingIndicator && recordingStatus === "recording"
        }
      /> */}

      {/* Header */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-6 pt-6">
        <Logo size="sm" showText={false} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="glass-button h-9 px-3 flex items-center gap-2 text-xs font-medium"
              title="Open menu"
            >
              <Menu className="h-4 w-4 text-foreground/70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="glass-card border-0 min-w-52 p-1.5"
          >
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onSelect={() => setShowTranscribe(true)}
            >
              <FileAudio className="h-4 w-4 text-foreground/70" />
              Transcribe File
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onSelect={() => setShowHistory(true)}
            >
              <History className="h-4 w-4 text-foreground/70" />
              History
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onSelect={() => setShowModels(true)}
            >
              <Cpu className="h-4 w-4 text-foreground/70" />
              Models
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onSelect={() => setShowLicense(true)}
            >
              <Key className="h-4 w-4 text-foreground/70" />
              License
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onSelect={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4 text-foreground/70" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onSelect={() => setShowHelpSupport(true)}
            >
              <HelpCircle className="h-4 w-4 text-foreground/70" />
              Help & Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Trial banner */}
      {trialDaysRemaining !== undefined && trialDaysRemaining > 0 && (
        <div className="relative z-10 mx-6 mt-4 shrink-0">
          <div className="glass-trial-banner px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Trial: {trialDaysRemaining} day
                {trialDaysRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
            <button
              className="glass-button px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
              onClick={() => setShowLicense(true)}
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-6 py-6 scrollable">
        <div className="min-h-full flex flex-col items-center justify-center">
          {!selectedModel || !selectedModel.downloaded ? (
            <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center max-w-xs">
              <div className="p-4 rounded-2xl bg-white/30 dark:bg-white/10 mb-4">
                <Cpu className="h-10 w-10 text-foreground/60" />
              </div>
              <h2 className="font-semibold text-foreground">
                {selectedModel ? "Download the active model" : "Choose a model"}
              </h2>
              <p className="text-sm text-foreground/60 mt-1">
                {selectedModel
                  ? `${selectedModel.name} is selected, but its local files are not installed.`
                  : "Download and activate a transcription model before recording."}
              </p>
              <button
                className="glass-button px-4 py-2 rounded-xl text-sm font-medium mt-4"
                onClick={() => setShowModels(true)}
              >
                Open Models
              </button>
            </div>
          ) : (
            <>
              {/* Recording orb */}
              <button
                onClick={toggleRecording}
                disabled={!isModelLoaded || recordingStatus === "processing"}
                className={cn(
                  "glass-orb h-32 w-32 flex items-center justify-center transition-all duration-300",
                  recordingStatus === "recording" && "glass-orb-recording",
                  recordingStatus === "processing" && "glass-orb-processing",
                  !isModelLoaded && "opacity-50 cursor-not-allowed",
                )}
              >
                {recordingStatus === "processing" ? (
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                ) : (
                  <Mic
                    className={cn(
                      "h-12 w-12 transition-colors",
                      recordingStatus === "recording"
                        ? "text-white"
                        : "text-foreground/60",
                    )}
                  />
                )}
              </button>

              {/* Status label */}
              <p
                className={cn(
                  "mt-5 text-sm font-medium tracking-wide",
                  recordingStatus === "recording"
                    ? "text-red-500 dark:text-red-400"
                    : recordingStatus === "processing"
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-foreground/60",
                )}
              >
                {config.label}
              </p>
            </>
          )}

          {/* Error message */}
          {errorMessage && selectedModel?.downloaded && (
            <div className="mt-4 glass-card w-full max-w-xs px-4 py-2.5 flex items-center gap-2.5 border-red-200 dark:border-red-800/50">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              </div>
              {errorMessage.toLowerCase().includes("model") && (
                <button
                  className="glass-button px-2 py-1 rounded-lg text-xs font-medium"
                  onClick={() => setShowModels(true)}
                >
                  Models
                </button>
              )}
            </div>
          )}

          {/* Hotkey hint */}
          {selectedModel?.downloaded && (
            <p className="mt-4 text-xs text-foreground/60 flex flex-wrap items-center justify-center gap-2 text-center">
              Press
              <span className="glass-kbd">{currentHotkey}</span>
              to{" "}
              {settings.hotkeyMode === "push-to-talk"
                ? "hold and speak"
                : "toggle"}
            </p>
          )}

          {/* Last transcription */}
          {lastTranscription && (
            <div className="glass-transcription w-full max-w-xs mt-8 p-4">
              <p className="text-[10px] uppercase tracking-wider text-foreground/50 mb-2 font-medium">
                Last transcription
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed break-words">
                {lastTranscription}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer status bar */}
      <div className="relative z-10 shrink-0 px-6 pb-6">
        <div className="glass-divider mb-4" />
        <div className="flex items-center justify-between gap-3">
          <div className="glass-status min-w-0">
            <span
              className={cn(
                "status-dot",
                isModelLoaded ? "status-dot-active" : "status-dot-warning",
              )}
            />
            <span className="text-foreground/70 font-medium truncate">
              {selectedModel?.name || "No model"}
            </span>
          </div>
          <div className="glass-badge shrink-0 text-foreground/60">
            {settings.hotkeyMode === "push-to-talk"
              ? "Push to Talk"
              : "Toggle Mode"}
          </div>
        </div>
      </div>
    </div>
  );
}
