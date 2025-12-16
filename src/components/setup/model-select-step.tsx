import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Check, Download, HardDrive, Loader2 } from "lucide-react";
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
    <div className="flex flex-col h-full px-6 py-8">
      <div className="space-y-1.5 mb-6">
        <p className="text-xs text-muted-foreground">Step 2 of 3</p>
        <h2 className="text-lg font-semibold">Choose AI Model</h2>
        <p className="text-sm text-muted-foreground">
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
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
                      {model.recommended && (
                        <Badge variant="secondary" className="text-xs h-5">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {model.size}
                      </span>
                      <span>
                        {model.languages
                          .map((l: string) => l.toUpperCase())
                          .join(", ")}
                      </span>
                    </div>

                    {isThisDownloading && (
                      <div className="mt-2 space-y-1">
                        <Progress value={downloadProgress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
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
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
            <p className="text-sm text-destructive font-medium">
              Download failed
            </p>
            <p className="text-xs text-destructive/80 mt-1">{downloadError}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onBack} disabled={isDownloading}>
          Back
        </Button>
        {!isDownloaded ? (
          <Button
            onClick={handleDownload}
            disabled={!selectedModel || isDownloading}
            className="flex-1"
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download ({selectedModel?.size || "Select model"})
              </>
            )}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={!canContinue} className="flex-1">
            <Check className="mr-2 h-4 w-4" />
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
