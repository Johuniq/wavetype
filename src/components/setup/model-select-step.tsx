import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  downloadModel,
  isModelDownloaded,
  onDownloadProgress,
  type DownloadProgress,
} from "@/lib/voice-api";
import { useAppStore, useAvailableModels } from "@/store";
import { WHISPER_MODELS, type WhisperModel } from "@/types";
import { Check, Download, HardDrive, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ModelSelectStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ModelSelectStep({ onNext, onBack }: ModelSelectStepProps) {
  const {
    selectedModel,
    setSelectedModel,
    downloadProgress,
    setDownloadProgress,
    modelStatus,
    setModelStatus,
    markModelDownloaded,
  } = useAppStore();

  // Get models from database, fallback to static list
  const dbModels = useAvailableModels();
  const models: WhisperModel[] =
    dbModels.length > 0 ? dbModels : WHISPER_MODELS;

  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Listen for download progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    onDownloadProgress((progress: DownloadProgress) => {
      if (progress.model_id === downloadingModelId) {
        setDownloadProgress(progress.percentage);
      }
    }).then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [downloadingModelId, setDownloadProgress]);

  // Check if selected model is already downloaded
  useEffect(() => {
    if (selectedModel) {
      isModelDownloaded(selectedModel.id)
        .then((downloaded) => {
          if (downloaded) {
            setModelStatus("downloaded");
          }
        })
        .catch(console.error);
    }
  }, [selectedModel, setModelStatus]);

  const handleSelectModel = (modelId: string) => {
    if (modelStatus === "downloading") return;
    const model = models.find((m: WhisperModel) => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      setDownloadError(null);
      // Check if already downloaded
      isModelDownloaded(modelId)
        .then((downloaded) => {
          if (downloaded) {
            setModelStatus("downloaded");
          } else {
            setModelStatus("not-downloaded");
          }
        })
        .catch(console.error);
    }
  };

  const handleDownload = async () => {
    if (!selectedModel) return;

    setDownloadingModelId(selectedModel.id);
    setModelStatus("downloading");
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      const modelPath = await downloadModel(selectedModel.id);
      setDownloadProgress(100);
      setModelStatus("downloaded");
      setDownloadingModelId(null);
      // Mark model as downloaded in store and database
      markModelDownloaded(selectedModel.id, modelPath);
    } catch (error) {
      console.error("Download failed:", error);
      setModelStatus("error");
      setDownloadingModelId(null);
      setDownloadError(
        error instanceof Error ? error.message : "Download failed"
      );
    }
  };

  const isDownloading = modelStatus === "downloading";
  const isDownloaded =
    modelStatus === "downloaded" ||
    modelStatus === "ready" ||
    selectedModel?.downloaded;
  const canContinue = selectedModel && isDownloaded;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      <div className="flex flex-col h-full px-6 py-8">
        <div className="space-y-1.5 mb-6">
          <p className="text-xs text-foreground/60 px-2 py-1 rounded-full bg-white/50 dark:bg-white/10 w-fit">
            Step 2 of 3
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Choose AI Model
          </h2>
          <p className="text-sm text-foreground/60">
            Larger models are more accurate but need more storage
          </p>
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <RadioGroup
            value={selectedModel?.id || ""}
            onValueChange={handleSelectModel}
            className="space-y-2"
          >
            {models.map((model: WhisperModel) => {
              const isSelected = selectedModel?.id === model.id;
              const isThisDownloading = downloadingModelId === model.id;

              return (
                <div key={model.id}>
                  <Label
                    htmlFor={model.id}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all glass-card",
                      isSelected &&
                        "ring-2 ring-foreground/30 border-foreground/20 bg-foreground/5",
                      isDownloading && !isThisDownloading && "opacity-50"
                    )}
                  >
                    <RadioGroupItem
                      value={model.id}
                      id={model.id}
                      disabled={isDownloading && !isThisDownloading}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">
                          {model.name}
                        </span>
                        {model.recommended && (
                          <span className="glass-badge flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-foreground/90 text-white bg-green font-medium">
                            <Sparkles className="h-3 w-3" />
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/60 mt-0.5">
                        {model.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-foreground/60">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/30 dark:bg-white/10">
                          <HardDrive className="h-3 w-3" />
                          {model.size}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-white/30 dark:bg-white/10">
                          {model.languages
                            .map((l: string) => l.toUpperCase())
                            .join(", ")}
                        </span>
                      </div>

                      {isThisDownloading && (
                        <div className="mt-3 space-y-1">
                          <div className="h-2 bg-white/30 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-foreground/80 transition-all duration-300 rounded-full"
                              style={{ width: `${downloadProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-foreground/60">
                            {Math.round(downloadProgress)}% downloaded
                          </p>
                        </div>
                      )}

                      {model.downloaded && !isThisDownloading && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" />
                          Downloaded
                        </div>
                      )}
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {downloadError && (
            <div className="mt-4 p-3 glass-card border-red-500/30 bg-red-500/10 rounded-2xl">
              <p className="text-sm text-red-500 font-medium">
                Download failed
              </p>
              <p className="text-xs text-red-500/80 mt-1">{downloadError}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/10 mt-4">
          <button
            className="glass-button py-2.5 px-4 rounded-xl text-sm font-medium disabled:opacity-50"
            onClick={onBack}
            disabled={isDownloading}
          >
            Back
          </button>
          {!isDownloaded ? (
            <button
              onClick={handleDownload}
              disabled={!selectedModel || isDownloading}
              className="glass-button flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25 disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download ({selectedModel?.size || "Select model"})
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onNext}
              disabled={!canContinue}
              className="glass-button flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
