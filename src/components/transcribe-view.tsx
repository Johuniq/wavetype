import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addTranscription, reportError, transcribeFile } from "@/lib/voice-api";
import { useAppStore } from "@/store";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  FileAudio,
  Loader2,
  RefreshCcw,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";

interface TranscribeViewProps {
  onClose: () => void;
}

export function TranscribeView({ onClose }: TranscribeViewProps) {
  const { settings } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : String(err || "Something went wrong");

  const handleSelectFile = async () => {
    if (isSelectingFile || isTranscribing) return;

    try {
      setIsSelectingFile(true);
      setError(null);
      setWarning(null);
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Audio",
            extensions: [
              "wav",
              "mp3",
              "m4a",
              "flac",
              "ogg",
              "webm",
              "aac",
              "mkv",
            ],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setSelectedFile(selected);
        // Extract filename from path
        const name = selected.split(/[/\\]/).pop() || selected;
        setFileName(name);
        setError(null);
        setTranscription("");
      }
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("Failed to select file:", err);
      setError(message || "Failed to select file");
      await reportError("filesystem", message, "error", {
        userAction: "Select audio file",
      }).catch(console.error);
    } finally {
      setIsSelectingFile(false);
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) {
      setError("Please select an audio file first");
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setWarning(null);
    setTranscription("");

    const startTime = Date.now();
    try {
      const text = await transcribeFile(
        selectedFile,
        settings.postProcessingEnabled
      );
      setTranscription(text);

      // Save to history
      if (text) {
        const durationMs = Date.now() - startTime;
        try {
          await addTranscription(
            text,
            settings.selectedModelId || "base",
            settings.language,
            durationMs
          );
        } catch (historyErr) {
          const message = getErrorMessage(historyErr);
          console.error("Failed to save to history:", historyErr);
          setWarning("Transcription completed, but history could not be saved.");
          await reportError("database", message, "warning", {
            userAction: "Save file transcription to history",
          }).catch(console.error);
        }
      }
    } catch (err) {
      const message = getErrorMessage(err) || "Transcription failed";
      console.error("Transcription failed:", err);
      setError(message);
      await reportError("transcription", message, "error", {
        userAction: "Transcribe audio file",
        context: {
          fileName,
          language: settings.language,
          modelId: settings.selectedModelId || "base",
        },
      }).catch(console.error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = async () => {
    if (!transcription) return;

    try {
      await navigator.clipboard.writeText(transcription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("Failed to copy:", err);
      setError("Could not copy transcription.");
      await reportError("ui", message, "error", {
        userAction: "Copy file transcription",
      }).catch(console.error);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileName("");
    setTranscription("");
    setError(null);
    setWarning(null);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      {/* Glass Header */}
      <div className="border-b border-white/20 dark:border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onClose}
          disabled={isTranscribing}
          className="glass-button px-1 py-1 rounded-xl text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4 text-foreground/70" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Transcribe Audio</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File Selection */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
              <Upload className="h-4 w-4 text-foreground/60" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                Select Audio File
              </h2>
              <p className="text-xs text-foreground/60">
                Choose a file to transcribe
              </p>
            </div>
          </div>

          {/* Drop Zone / File Info */}
          <div
            onClick={handleSelectFile}
            className={cn(
              "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
              "bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10",
              (isSelectingFile || isTranscribing) && "opacity-70 cursor-wait",
              selectedFile
                ? "border-foreground/30 bg-foreground/5"
                : "border-white/30 dark:border-white/10 hover:border-foreground/30"
            )}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-3 rounded-xl bg-white/30 dark:bg-white/10">
                  {isSelectingFile ? (
                    <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
                  ) : (
                    <FileAudio className="h-8 w-8 text-foreground/60" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground truncate max-w-[200px]">
                    {fileName}
                  </p>
                  <p className="text-xs text-foreground/60">
                    Click to change file
                  </p>
                </div>
                <button
                  className="glass-icon-button p-2 rounded-lg ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  disabled={isTranscribing}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white/30 dark:bg-white/10 w-fit mx-auto">
                  {isSelectingFile ? (
                    <Loader2 className="h-10 w-10 animate-spin text-foreground/60" />
                  ) : (
                    <Upload className="h-10 w-10 text-foreground/60" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {isSelectingFile ? "Opening file picker..." : "Click to select an audio file"}
                </p>
                <p className="text-xs text-foreground/60">
                  Supports WAV, MP3, M4A, FLAC, OGG, WebM
                </p>
              </div>
            )}
          </div>

          {/* Transcribe Button */}
          <button
            onClick={handleTranscribe}
            disabled={!selectedFile || isTranscribing}
            className={cn(
              "w-full mt-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all",
              selectedFile && !isTranscribing
                ? "text-white bg-foreground/90 hover:bg-foreground shadow-lg shadow-foreground/25"
                : "glass-button opacity-50 cursor-not-allowed"
            )}
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <FileAudio className="h-4 w-4" />
                Transcribe
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p>{error}</p>
                  {selectedFile && !isTranscribing && (
                    <button
                      className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium mt-3 flex items-center gap-1.5"
                      onClick={handleTranscribe}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {warning && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
              {warning}
            </div>
          )}
        </div>

        {/* Transcription Result */}
        {(transcription || isTranscribing) && (
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
                  <Check className="h-4 w-4 text-foreground/60" />
                </div>
                <h2 className="font-semibold text-sm text-foreground">
                  Transcription
                </h2>
              </div>
              {transcription && (
                <button
                  className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5"
                  onClick={handleCopy}
                  disabled={copied}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>

            {isTranscribing ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-foreground/60" />
                <span className="ml-2 text-foreground/60">
                  Processing audio...
                </span>
              </div>
            ) : (
              <Textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="min-h-[200px] resize-none bg-white/30 dark:bg-white/5 border-white/30 dark:border-white/10 rounded-xl"
                placeholder="Transcription will appear here..."
              />
            )}
          </div>
        )}

        {/* Instructions */}
        {!selectedFile && !transcription && (
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
                <FileAudio className="h-4 w-4 text-foreground/60" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">
                How to use
              </h3>
            </div>
            <ol className="text-sm text-foreground/70 space-y-2 list-decimal list-inside ml-1">
              <li>Click the upload area to select an audio file</li>
              <li>Click "Transcribe" to turn the audio into clean text</li>
              <li>Copy the text or edit it as needed</li>
            </ol>
            <p className="text-xs text-foreground/60 mt-4 p-3 rounded-xl bg-white/30 dark:bg-white/10">
              💡 For best results, use clear audio with minimal background
              noise.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
