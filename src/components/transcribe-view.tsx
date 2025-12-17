import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { transcribeFile } from "@/lib/voice-api";
import { useAppStore } from "@/store";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
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
            extensions: ["wav", "mp3", "m4a", "flac", "ogg", "webm"],
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

    try {
      const text = await transcribeFile(
        selectedFile,
        settings.postProcessingEnabled
      );
      setTranscription(text);
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Transcribe Audio File</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Audio File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop Zone / File Info */}
            <div
              onClick={handleSelectFile}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                "hover:border-primary hover:bg-muted/50",
                selectedFile
                  ? "border-primary bg-muted/30"
                  : "border-muted-foreground/25"
              )}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileAudio className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[200px]">
                      {fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click to change file
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select an audio file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports WAV, MP3, M4A, FLAC, OGG, WebM
                  </p>
                </div>
              )}
            </div>

            {/* Transcribe Button */}
            <Button
              onClick={handleTranscribe}
              disabled={!selectedFile || isTranscribing}
              className="w-full"
              size="lg"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <FileAudio className="h-4 w-4 mr-2" />
                  Transcribe
                </>
              )}
            </Button>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Transcription Result */}
        {(transcription || isTranscribing) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Transcription</CardTitle>
                {transcription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8"
                  >
                    <ClipboardCopy className="h-4 w-4 mr-2" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isTranscribing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">
                    Processing audio...
                  </span>
                </div>
              ) : (
                <Textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="min-h-[200px] resize-none"
                  placeholder="Transcription will appear here..."
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!selectedFile && !transcription && (
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-2">How to use</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Click the upload area to select an audio file</li>
                <li>Click "Transcribe" to convert speech to text</li>
                <li>Copy the transcription or edit it as needed</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-4">
                Note: For best results, use clear audio with minimal background
                noise. Currently only WAV files are fully supported.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
