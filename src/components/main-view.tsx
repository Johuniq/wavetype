import { HistoryView } from "@/components/history-view";
import { LicenseView } from "@/components/license-view";
import { Logo } from "@/components/logo";
import { SettingsView } from "@/components/settings-view";
import { TranscribeView } from "@/components/transcribe-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { playFeedbackSound } from "@/lib/preferences-api";
import { cn } from "@/lib/utils";
import {
  addTranscription,
  loadModel,
  onHotkeyPressed,
  onHotkeyReleased,
  onTrayStartRecording,
  onTrayStopRecording,
  registerHotkey,
  startRecording,
  stopTranscribeAndInject,
  unregisterHotkeys,
} from "@/lib/voice-api";
import { useAppStore } from "@/store";
import type { RecordingStatus } from "@/types";
import {
  AlertCircle,
  Clock,
  FileAudio,
  History,
  Key,
  Loader2,
  Mic,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SpeakingOverlay } from "./ui/speaking-overlay";

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
  const [showHistory, setShowHistory] = useState(false);
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  // Refs to track recording state for hotkey handlers
  const recordingStatusRef = useRef(recordingStatus);
  const isModelLoadedRef = useRef(isModelLoaded);
  const hotkeyModeRef = useRef(settings.hotkeyMode);

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

  const currentHotkey =
    settings.hotkeyMode === "push-to-talk"
      ? settings.pushToTalkKey
      : settings.toggleKey;

  // Load the model on mount
  useEffect(() => {
    if (selectedModel && !isModelLoaded && !isLoadingModel) {
      setIsLoadingModel(true);
      loadModel(selectedModel.id, settings.language)
        .then(() => {
          setIsModelLoaded(true);
          setIsLoadingModel(false);
          console.log("Model loaded:", selectedModel.id);
        })
        .catch((error) => {
          console.error("Failed to load model:", error);
          setIsLoadingModel(false);
          setErrorMessage("Failed to load AI model");
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

      // Play audio feedback if enabled
      if (settings.playAudioFeedback) {
        playFeedbackSound("start");
      }

      await startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setErrorMessage("Failed to start recording");
      recordingStatusRef.current = "error";
      setRecordingStatus("error");
    }
  }, [setErrorMessage, setRecordingStatus, settings.playAudioFeedback]);

  // Handle stopping recording
  const handleStopRecording = useCallback(async () => {
    if (recordingStatusRef.current !== "recording") {
      console.log("Not recording, skipping stop");
      return;
    }

    // Set status IMMEDIATELY to prevent duplicate calls
    recordingStatusRef.current = "processing";
    setRecordingStatus("processing");

    // Play audio feedback if enabled
    if (settings.playAudioFeedback) {
      playFeedbackSound("stop");
    }

    try {
      const startTime = Date.now();
      const text = await stopTranscribeAndInject(
        settings.postProcessingEnabled
      );
      const durationMs = Date.now() - startTime;
      if (text) {
        setLastTranscription(text);
        // Save to history
        try {
          const insertedId = await addTranscription(
            text,
            selectedModel?.id || "base",
            settings.language,
            durationMs
          );
          console.log("Saved transcription id:", insertedId);
          toastSuccess("Saved transcription", `ID: ${insertedId}`);
        } catch (historyError: any) {
          console.error("Failed to save to history:", historyError);
          const msg =
            historyError?.toString?.() || "Unknown error saving transcription";
          toastError("Failed to save transcription", msg);
        }
      }
      recordingStatusRef.current = "idle";
      setRecordingStatus("idle");
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
    settings.playAudioFeedback,
    settings.postProcessingEnabled,
    selectedModel?.id,
    settings.language,
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

    const setupTrayListeners = async () => {
      unlistenStart = await onTrayStartRecording(() => {
        handleStartRecording();
      });

      unlistenStop = await onTrayStopRecording(() => {
        handleStopRecording();
      });
    };

    setupTrayListeners();

    return () => {
      unlistenStart?.();
      unlistenStop?.();
    };
  }, [handleStartRecording, handleStopRecording]);

  const toggleRecording = async () => {
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
  };

  const statusConfig: Record<
    RecordingStatus,
    {
      bgClass: string;
      iconClass: string;
      label: string;
    }
  > = {
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
  };

  const config = statusConfig[recordingStatus];

  // Show settings view
  if (showSettings) {
    return <SettingsView onClose={() => setShowSettings(false)} />;
  }

  // Show history view
  if (showHistory) {
    return <HistoryView onClose={() => setShowHistory(false)} />;
  }

  // Show transcribe view
  if (showTranscribe) {
    return <TranscribeView onClose={() => setShowTranscribe(false)} />;
  }

  // Show license view
  if (showLicense) {
    return <LicenseView onClose={() => setShowLicense(false)} />;
  }

  // Show loading state while model is loading
  if (isLoadingModel) {
    return (
      <div className="flex flex-col h-full p-6 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Loading AI model...
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedModel?.name || "Base"} model
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Full-screen speaking animation overlay */}
      <SpeakingOverlay
        visible={
          settings.showRecordingIndicator && recordingStatus === "recording"
        }
      />
      <div className="flex items-center justify-between">
        <Logo size="sm" showText={false} />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowTranscribe(true)}
            title="Transcribe Audio File"
          >
            <FileAudio className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowHistory(true)}
            title="History"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowLicense(true)}
            title="License"
          >
            <Key className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Trial banner */}
      {trialDaysRemaining !== undefined && trialDaysRemaining > 0 && (
        <div className="mt-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Trial: {trialDaysRemaining} day
              {trialDaysRemaining !== 1 ? "s" : ""} remaining
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
            onClick={() => setShowLicense(true)}
          >
            Upgrade
          </Button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        <button
          onClick={toggleRecording}
          disabled={!isModelLoaded || recordingStatus === "processing"}
          className={cn(
            "h-28 w-28 rounded-full flex items-center justify-center transition-all",
            config.bgClass,
            recordingStatus === "recording" &&
              "ring-4 ring-destructive/30 animate-pulse",
            !isModelLoaded && "opacity-50 cursor-not-allowed"
          )}
        >
          {recordingStatus === "processing" ? (
            <Loader2
              className={cn("h-12 w-12 animate-spin", config.iconClass)}
            />
          ) : (
            <Mic className={cn("h-12 w-12", config.iconClass)} />
          )}
        </button>

        <p
          className={cn(
            "mt-4 text-sm font-medium",
            recordingStatus === "recording"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {config.label}
        </p>

        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs">{errorMessage}</p>
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Press{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            {currentHotkey}
          </code>{" "}
          to{" "}
          {settings.hotkeyMode === "push-to-talk" ? "hold and speak" : "toggle"}
        </p>

        {lastTranscription && (
          <Card className="w-full max-w-xs mt-6">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Last transcription
              </p>
              <p className="text-sm">{lastTranscription}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isModelLoaded ? "bg-green-500" : "bg-yellow-500"
            )}
          />
          <span>{selectedModel?.name || "Base"}</span>
        </div>
        <span>
          {settings.hotkeyMode === "push-to-talk" ? "Push to Talk" : "Toggle"}
        </span>
      </div>
    </div>
  );
}
