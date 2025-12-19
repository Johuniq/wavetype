import { Logo } from "@/components/logo";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UpdaterView } from "@/components/updater-view";
import { useToast } from "@/hooks/use-toast";
import {
  downloadFile,
  exportAppData,
  getStorageStats,
} from "@/lib/data-management";
import { setAutoStart } from "@/lib/preferences-api";
import { cn } from "@/lib/utils";
import {
  deleteModel,
  downloadModel,
  onDownloadProgress,
} from "@/lib/voice-api";
import { useAppStore, useAvailableModels } from "@/store";
import type { WhisperModel } from "@/types";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Cpu,
  Database,
  Download,
  FileDown,
  Keyboard,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  Waves,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const {
    settings,
    updateSettings,
    resetSettings,
    selectedModel,
    setSelectedModel,
    markModelDownloaded,
  } = useAppStore();
  const availableModels = useAvailableModels();
  const { success: toastSuccess, error: toastError } = useToast();

  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    historyCount: number;
  } | null>(null);
  const [recordingPushToTalk, setRecordingPushToTalk] = useState(false);
  const [recordingToggle, setRecordingToggle] = useState(false);

  // Load storage stats
  useEffect(() => {
    getStorageStats().then(setStorageStats).catch(console.error);
  }, []);

  // Listen for download progress
  useEffect(() => {
    const unsubscribe = onDownloadProgress((progress) => {
      setDownloadProgress(progress.percentage);
    });

    return () => {
      unsubscribe.then((fn) => fn());
    };
  }, []);

  const handleDownloadModel = async (model: WhisperModel) => {
    try {
      setDownloadingModelId(model.id);
      setDownloadProgress(0);

      await downloadModel(model.id);
      markModelDownloaded(model.id);
      toastSuccess("Model downloaded", `${model.name} is ready to use`);

      setDownloadingModelId(null);
    } catch (err) {
      console.error("Download failed:", err);
      toastError("Download failed", `Failed to download ${model.name} model`);
      setDownloadingModelId(null);
    }
  };

  const handleDeleteModel = async (model: WhisperModel) => {
    if (!model.downloaded) return;

    try {
      setDeletingModelId(model.id);

      await deleteModel(model.id);

      // If deleting selected model, clear selection
      if (selectedModel?.id === model.id) {
        setSelectedModel(null);
      }

      toastSuccess("Model deleted", `${model.name} has been removed`);
      // Reload to get updated model state
      window.location.reload();

      setDeletingModelId(null);
    } catch (err) {
      console.error("Delete failed:", err);
      toastError("Delete failed", `Failed to delete ${model.name} model`);
      setDeletingModelId(null);
    }
  };

  const handleSelectModel = (model: WhisperModel) => {
    if (model.downloaded) {
      setSelectedModel(model);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await exportAppData();
      const filename = `WaveType-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      const saved = await downloadFile(data, filename);
      if (saved) {
        toastSuccess("Export complete", "Data exported successfully");
      }
    } catch (err) {
      console.error("Export failed:", err);
      toastError("Export failed", "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  // Hotkey recording handlers
  const handleRecordHotkey = (type: "pushToTalk" | "toggle") => {
    if (type === "pushToTalk") {
      setRecordingPushToTalk(true);
      setRecordingToggle(false);
    } else {
      setRecordingToggle(true);
      setRecordingPushToTalk(false);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (e.metaKey) parts.push("Meta");

      // Get the key name
      let key = e.key;
      if (key === " ") key = "Space";
      else if (key.length === 1) key = key.toUpperCase();
      else if (key.startsWith("Arrow")) key = key;
      else if (
        key === "Control" ||
        key === "Shift" ||
        key === "Alt" ||
        key === "Meta"
      ) {
        // Don't record modifier-only keys
        return;
      }

      parts.push(key);
      const hotkey = parts.join("+");

      if (type === "pushToTalk") {
        updateSettings({ pushToTalkKey: hotkey });
        setRecordingPushToTalk(false);
      } else {
        updateSettings({ toggleKey: hotkey });
        setRecordingToggle(false);
      }

      document.removeEventListener("keydown", handleKeyDown);
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cancel after 5 seconds
    setTimeout(() => {
      setRecordingPushToTalk(false);
      setRecordingToggle(false);
      document.removeEventListener("keydown", handleKeyDown);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      {/* Glass Header */}
      <div className="liquid-glass border-b border-white/20 dark:border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="glass-icon-button p-2 rounded-xl">
          <ArrowLeft className="h-4 w-4 text-foreground/70" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hotkey Settings */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
              <Keyboard className="h-4 w-4 text-foreground/60" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                Hotkey Mode
              </h2>
              <p className="text-xs text-foreground/60">
                Configure recording shortcuts
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
                Recording Mode
              </Label>
              <Select
                value={settings.hotkeyMode}
                onValueChange={(value: "push-to-talk" | "toggle") =>
                  updateSettings({ hotkeyMode: value })
                }
              >
                <SelectTrigger className="glass-button border-0 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-0">
                  <SelectItem value="push-to-talk">Push to Talk</SelectItem>
                  <SelectItem value="toggle">Toggle</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-foreground/60">
                {settings.hotkeyMode === "push-to-talk"
                  ? "Hold the key to record, release to stop"
                  : "Press once to start, press again to stop"}
              </p>
            </div>

            <div className="h-px bg-border/50" />

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
                Push to Talk Key
              </Label>
              <div className="flex items-center gap-2">
                <code
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-sm font-mono transition-all",
                    "bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10",
                    recordingPushToTalk && "animate-pulse border-blue-500/50"
                  )}
                >
                  {recordingPushToTalk
                    ? "Press any key..."
                    : settings.pushToTalkKey}
                </code>
                <button
                  className="glass-button px-3 py-2 text-xs font-medium rounded-xl"
                  onClick={() => handleRecordHotkey("pushToTalk")}
                  disabled={recordingPushToTalk}
                >
                  {recordingPushToTalk ? "Recording..." : "Change"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
                Toggle Key
              </Label>
              <div className="flex items-center gap-2">
                <code
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-sm font-mono transition-all",
                    "bg-white/50 dark:bg-white/5 border border-white/30 dark:border-white/10",
                    recordingToggle && "animate-pulse border-blue-500/50"
                  )}
                >
                  {recordingToggle ? "Press any key..." : settings.toggleKey}
                </code>
                <button
                  className="glass-button px-3 py-2 text-xs font-medium rounded-xl"
                  onClick={() => handleRecordHotkey("toggle")}
                  disabled={recordingToggle}
                >
                  {recordingToggle ? "Recording..." : "Change"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Model Management */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
              <Cpu className="h-4 w-4 text-foreground/60" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                AI Model
              </h2>
              <p className="text-xs text-foreground/60">
                Select and manage Whisper models
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {availableModels.map((model) => (
              <div
                key={model.id}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer",
                  "bg-white/30 dark:bg-white/5 border-white/30 dark:border-white/10",
                  "hover:bg-white/50 dark:hover:bg-white/10",
                  selectedModel?.id === model.id &&
                    "ring-2 ring-foreground/30 border-foreground/20 bg-foreground/5"
                )}
                onClick={() => model.downloaded && handleSelectModel(model)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {model.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10 text-foreground/60">
                        {model.size}
                      </span>
                      {model.downloaded && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          Ready
                        </span>
                      )}
                      {selectedModel?.id === model.id && (
                        <span className="glass-status text-xs bg-foreground/90 text-white px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/60 mt-1">
                      {model.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    {model.downloaded ? (
                      <>
                        {selectedModel?.id !== model.id && (
                          <button
                            className="glass-button px-2 py-1 text-xs font-medium rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectModel(model);
                            }}
                          >
                            Use
                          </button>
                        )}
                        <button
                          className="glass-icon-button p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModel(model);
                          }}
                          disabled={deletingModelId === model.id}
                        >
                          {deletingModelId === model.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        className="glass-button px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadModel(model);
                        }}
                        disabled={downloadingModelId !== null}
                      >
                        {downloadingModelId === model.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {Math.floor(downloadProgress)}%
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            Download
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {downloadingModelId === model.id && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-white/30 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground/80 transition-all duration-300 rounded-full"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* UI Preferences */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
              <Sparkles className="h-4 w-4 text-foreground/60" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                Preferences
              </h2>
              <p className="text-xs text-foreground/60">
                Customize your experience
              </p>
            </div>
          </div>

          <div className="space-y-1">
            {/* Recording Indicator */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground/60" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Recording Indicator
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Show visual feedback when recording
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showRecordingIndicator}
                onCheckedChange={(checked) =>
                  updateSettings({ showRecordingIndicator: checked })
                }
              />
            </div>

            {/* Fullscreen Recording Overlay */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <Waves className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Recording Overlay
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Show fullscreen wave animation when recording
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showRecordingOverlay}
                onCheckedChange={(checked) =>
                  updateSettings({ showRecordingOverlay: checked })
                }
              />
            </div>

            {/* Audio Feedback */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <Volume2 className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Audio Feedback
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Play sound when recording starts/stops
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.playAudioFeedback}
                onCheckedChange={(checked) =>
                  updateSettings({ playAudioFeedback: checked })
                }
              />
            </div>

            {/* Start on Boot */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <ChevronRight className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Start on Boot
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Launch WaveType when system starts
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.autoStartOnBoot}
                onCheckedChange={async (checked) => {
                  try {
                    await setAutoStart(checked);
                    updateSettings({ autoStartOnBoot: checked });
                  } catch (err) {
                    console.error("Failed to set autostart:", err);
                    toastError(
                      "Settings error",
                      "Failed to change autostart setting"
                    );
                  }
                }}
              />
            </div>

            {/* Minimize to Tray */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <div className="w-3 h-2 border-2 border-foreground/60 rounded-sm" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Minimize to Tray
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Keep running in system tray when closed
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.minimizeToTray}
                onCheckedChange={(checked) =>
                  updateSettings({ minimizeToTray: checked })
                }
              />
            </div>

            {/* Smart Text Processing */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Smart Text Processing
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Auto-format: "camel case" → camelCase
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.postProcessingEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ postProcessingEnabled: checked })
                }
              />
            </div>

            {/* Clipboard Mode */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <svg
                    className="h-4 w-4 text-foreground/60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Clipboard Mode
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Copy text to clipboard instead of typing
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.clipboardMode}
                onCheckedChange={(checked) =>
                  updateSettings({ clipboardMode: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
              <Database className="h-4 w-4 text-foreground/60" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                Data Management
              </h2>
              <p className="text-xs text-foreground/60">
                Export and manage your data
              </p>
            </div>
          </div>

          {storageStats && (
            <div className="p-3 rounded-xl bg-white/30 dark:bg-white/10 border border-white/30 dark:border-white/10 mb-3">
              <p className="text-sm">
                <span className="font-semibold text-foreground">
                  {storageStats.historyCount}
                </span>
                <span className="text-foreground/60">
                  {" "}
                  transcriptions in history
                </span>
              </p>
            </div>
          )}

          <button
            className="glass-button w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Export Data
          </button>

          <p className="text-xs text-foreground/60 mt-2 text-center">
            Export your settings and history to a JSON file
          </p>
        </div>

        {/* Software Updates */}
        <UpdaterView />

        {/* Reset Settings */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-red-500/10">
              <RotateCcw className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                Reset Settings
              </h2>
              <p className="text-xs text-foreground/60">
                Restore all options to defaults
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="glass-button w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all">
                <RotateCcw className="h-4 w-4" />
                Reset to Defaults
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card border-0">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Settings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore all settings to their default values. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="glass-button">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    try {
                      resetSettings();
                      toastSuccess?.("Settings reset to defaults");
                    } catch (e) {
                      toastError?.("Failed to reset settings");
                    }
                  }}
                  className="bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600"
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* App Info Footer */}
        <div className="glass-card p-6 rounded-2xl overflow-hidden relative">
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3">
              <Logo size="sm" />
            </div>
            <p className="text-xs text-foreground/60">
              Voice typing fast and privately with AI
            </p>
            <div className="h-px w-16 bg-border/50 my-3" />
            <p className="text-xs text-foreground/60">
              © 2025 JohUniq. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
