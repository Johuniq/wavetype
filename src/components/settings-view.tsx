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
import { reportError } from "@/lib/voice-api";
import { useAppStore } from "@/store";
import {
    AlertCircle,
    ArrowLeft,
    ChevronRight,
    Database,
    FileDown,
    Keyboard,
    Loader2,
    RefreshCcw,
    RotateCcw,
    Sparkles,
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
  } = useAppStore();
  const { success: toastSuccess, error: toastError } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<{
    historyCount: number;
  } | null>(null);
  const [recordingPushToTalk, setRecordingPushToTalk] = useState(false);
  const [recordingToggle, setRecordingToggle] = useState(false);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error || "Something went wrong");

  // Load storage stats
  const loadStorageStats = async () => {
    try {
      setIsLoadingStats(true);
      setStatsError(null);
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      const message = getErrorMessage(error);
      setStatsError(message);
      await reportError("database", message, "warning", {
        userAction: "Load storage stats",
      }).catch(console.error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStorageStats();
  }, []);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      const data = await exportAppData();
      const filename = `Wavee-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      const saved = await downloadFile(data, filename);
      if (saved) {
        toastSuccess("Export complete", "Data exported successfully");
      }
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("Export failed:", err);
      setExportError(message);
      toastError("Export failed", "Failed to export data");
      await reportError("filesystem", message, "error", {
        userAction: "Export app data",
      }).catch(console.error);
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
        setSettingsError(null);
        setRecordingPushToTalk(false);
      } else {
        updateSettings({ toggleKey: hotkey });
        setSettingsError(null);
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
      <div className="border-b border-white/20 dark:border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="glass-button px-1 py-1 rounded-xl text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4 text-foreground/70" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {settingsError && (
          <div className="glass-card p-3 rounded-2xl border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{settingsError}</span>
          </div>
        )}
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
                    Launch Wavee when system starts
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.autoStartOnBoot}
                onCheckedChange={async (checked) => {
                  try {
                    setSettingsError(null);
                    await setAutoStart(checked);
                    updateSettings({ autoStartOnBoot: checked });
                  } catch (err) {
                    const message = getErrorMessage(err);
                    console.error("Failed to set autostart:", err);
                    setSettingsError("Could not change Start on Boot.");
                    toastError(
                      "Settings error",
                      "Failed to change autostart setting"
                    );
                    await reportError("configuration", message, "error", {
                      userAction: "Change autostart setting",
                    }).catch(console.error);
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

            {/* Voice Commands */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/30 dark:bg-white/10 flex items-center justify-center">
                  <Keyboard className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer text-foreground">
                    Voice Commands
                  </Label>
                  <p className="text-xs text-foreground/60">
                    Allow spoken editing commands like undo, paste, and delete line
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.voiceCommandsEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ voiceCommandsEnabled: checked })
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

          {isLoadingStats ? (
            <div className="p-3 rounded-xl bg-white/30 dark:bg-white/10 border border-white/30 dark:border-white/10 mb-3 flex items-center gap-2 text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading storage stats...</span>
            </div>
          ) : statsError ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">Could not load storage stats.</p>
                  <button
                    className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium mt-2 flex items-center gap-1.5"
                    onClick={loadStorageStats}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : storageStats && (
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
          {exportError && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{exportError}</span>
            </div>
          )}
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
                      setSettingsError(null);
                      toastSuccess?.("Settings reset to defaults");
                    } catch (e) {
                      const message = getErrorMessage(e);
                      setSettingsError("Could not reset settings.");
                      toastError?.("Failed to reset settings");
                      reportError("configuration", message, "error", {
                        userAction: "Reset settings",
                      }).catch(console.error);
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
              Wave your voice into text at your cursor
            </p>
            <div className="h-px w-16 bg-border/50 my-3" />
            <p className="text-xs text-foreground/60">
              © {new Date().getFullYear()} Johuniq. Released under the MIT License.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
