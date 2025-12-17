import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UpdaterView } from "@/components/updater-view";
import {
  downloadFile,
  exportAppData,
  getStorageStats,
} from "@/lib/data-management";
import { setAutoStart } from "@/lib/preferences-api";
import {
  deleteModel,
  downloadModel,
  onDownloadProgress,
} from "@/lib/voice-api";
import { useAppStore, useAvailableModels } from "@/store";
import type { WhisperModel } from "@/types";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileDown,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

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

  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      setError(null);
      setDownloadingModelId(model.id);
      setDownloadProgress(0);

      await downloadModel(model.id);
      markModelDownloaded(model.id);

      setDownloadingModelId(null);
    } catch (err) {
      console.error("Download failed:", err);
      setError(`Failed to download ${model.name} model`);
      setDownloadingModelId(null);
    }
  };

  const handleDeleteModel = async (model: WhisperModel) => {
    if (!model.downloaded) return;

    try {
      setError(null);
      setDeletingModelId(model.id);

      await deleteModel(model.id);

      // If deleting selected model, clear selection
      if (selectedModel?.id === model.id) {
        setSelectedModel(null);
      }

      // Reload to get updated model state
      window.location.reload();

      setDeletingModelId(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setError(`Failed to delete ${model.name} model`);
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
      setError(null);
      const data = await exportAppData();
      const filename = `WaveType-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      const saved = await downloadFile(data, filename);
      if (saved) {
        setSuccessMessage("Data exported successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to export data");
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <p className="text-sm">{successMessage}</p>
          </div>
        )}

        {/* Hotkey Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hotkey Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recording Mode</Label>
              <Select
                value={settings.hotkeyMode}
                onValueChange={(value: "push-to-talk" | "toggle") =>
                  updateSettings({ hotkeyMode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="push-to-talk">Push to Talk</SelectItem>
                  <SelectItem value="toggle">Toggle</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {settings.hotkeyMode === "push-to-talk"
                  ? "Hold the key to record, release to stop"
                  : "Press once to start, press again to stop"}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Push to Talk Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                  {recordingPushToTalk
                    ? "Press any key..."
                    : settings.pushToTalkKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRecordHotkey("pushToTalk")}
                  disabled={recordingPushToTalk}
                >
                  {recordingPushToTalk ? "Recording..." : "Change"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Toggle Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                  {recordingToggle ? "Press any key..." : settings.toggleKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRecordHotkey("toggle")}
                  disabled={recordingToggle}
                >
                  {recordingToggle ? "Recording..." : "Change"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select and manage Whisper models for transcription
            </p>

            {availableModels.map((model) => (
              <div
                key={model.id}
                className={`p-3 rounded-lg border transition-colors ${
                  selectedModel?.id === model.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.size}
                      </span>
                      {model.downloaded && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" />
                          Downloaded
                        </span>
                      )}
                      {selectedModel?.id === model.id && (
                        <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {model.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    {model.downloaded ? (
                      <>
                        {selectedModel?.id !== model.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSelectModel(model)}
                          >
                            Use
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteModel(model)}
                          disabled={deletingModelId === model.id}
                        >
                          {deletingModelId === model.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDownloadModel(model)}
                        disabled={downloadingModelId !== null}
                      >
                        {downloadingModelId === model.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {Math.floor(downloadProgress)}%
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Download progress bar */}
                {downloadingModelId === model.id && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* UI Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Recording Indicator</Label>
                <p className="text-xs text-muted-foreground">
                  Show visual feedback when recording
                </p>
              </div>
              <Switch
                checked={settings.showRecordingIndicator}
                onCheckedChange={(checked) =>
                  updateSettings({ showRecordingIndicator: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Audio Feedback</Label>
                <p className="text-xs text-muted-foreground">
                  Play sound when recording starts/stops
                </p>
              </div>
              <Switch
                checked={settings.playAudioFeedback}
                onCheckedChange={(checked) =>
                  updateSettings({ playAudioFeedback: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Start on Boot</Label>
                <p className="text-xs text-muted-foreground">
                  Launch WaveType when system starts
                </p>
              </div>
              <Switch
                checked={settings.autoStartOnBoot}
                onCheckedChange={async (checked) => {
                  try {
                    await setAutoStart(checked);
                    updateSettings({ autoStartOnBoot: checked });
                  } catch (err) {
                    console.error("Failed to set autostart:", err);
                    setError("Failed to change autostart setting");
                  }
                }}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Minimize to Tray</Label>
                <p className="text-xs text-muted-foreground">
                  Keep running in system tray when closed
                </p>
              </div>
              <Switch
                checked={settings.minimizeToTray}
                onCheckedChange={(checked) =>
                  updateSettings({ minimizeToTray: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Smart Text Processing</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-format code: "camel case" → camelCase, "index dot ts" →
                  index.ts
                </p>
              </div>
              <Switch
                checked={settings.postProcessingEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ postProcessingEnabled: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {storageStats && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">
                    {storageStats.historyCount}
                  </span>{" "}
                  transcriptions in history
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Export Data
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Export your settings and history to a JSON file for backup.
            </p>
          </CardContent>
        </Card>

        {/* Software Updates */}
        <UpdaterView />

        {/* Reset Settings */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm("Reset all settings to defaults?")) {
              resetSettings();
            }
          }}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>

        {/* App Info */}
        <div className="flex flex-col items-center py-4 text-center">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">
            Voice typing fast and privately with AI
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            © 2025 JohUniq. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
