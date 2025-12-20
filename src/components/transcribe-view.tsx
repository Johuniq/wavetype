import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addTranscription, transcribeFile } from "@/lib/voice-api";
import { useAppStore } from "@/store";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  FileAudio,
  Loader2,
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSelectFile = async () => {
    try {
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
      console.error("Failed to select file:", err);
      setError("Failed to select file");
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) {
      setError("Please select an audio file first");
      return;
    }

    setIsTranscribing(true);
    setError(null);
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
          console.error("Failed to save to history:", historyErr);
        }
      }
    } catch (err) {
      console.error("Transcription failed:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
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
      console.error("Failed to copy:", err);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileName("");
    setTranscription("");
    setError(null);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      {/* Glass Header */}
      <div className="border-b border-white/20 dark:border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onClose}
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
              selectedFile
                ? "border-foreground/30 bg-foreground/5"
                : "border-white/30 dark:border-white/10 hover:border-foreground/30"
            )}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-3 rounded-xl bg-white/30 dark:bg-white/10">
                  <FileAudio className="h-8 w-8 text-foreground/60" />
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
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white/30 dark:bg-white/10 w-fit mx-auto">
                  <Upload className="h-10 w-10 text-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Click to select an audio file
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
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
              {error}
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
              <li>Click "Transcribe" to convert speech to text</li>
              <li>Copy the transcription or edit it as needed</li>
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
