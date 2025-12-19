import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Mic,
  MicOff,
} from "lucide-react";
import { useState } from "react";

interface MicrophoneStepProps {
  onNext: () => void;
  onBack: () => void;
}

type PermissionStatus = "pending" | "checking" | "granted" | "denied";

export function MicrophoneStep({ onNext, onBack }: MicrophoneStepProps) {
  const [status, setStatus] = useState<PermissionStatus>("pending");
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [testCompleted, setTestCompleted] = useState(false);

  const requestPermission = async () => {
    setStatus("checking");
    setTestCompleted(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      setStatus("granted");
      setIsTestingMic(true);

      let animationId: number;
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMicLevel(Math.min(100, average * 2));
        animationId = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setTimeout(() => {
        cancelAnimationFrame(animationId);
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
        setIsTestingMic(false);
        setMicLevel(0);
        setTestCompleted(true);
      }, 3000);
    } catch (error) {
      console.error("Microphone permission error:", error);
      setStatus("denied");
    }
  };

  const skipTest = () => {
    setStatus("granted");
    setTestCompleted(true);
  };

  const statusConfig = {
    pending: {
      icon: Mic,
      iconClass: "text-foreground/60",
      bgClass: "bg-white/30 dark:bg-white/10",
    },
    checking: {
      icon: Loader2,
      iconClass: "text-foreground/60 animate-spin",
      bgClass: "bg-white/40 dark:bg-white/15",
    },
    granted: {
      icon: CheckCircle2,
      iconClass: "text-green-500",
      bgClass: "bg-green-500/10",
    },
    denied: {
      icon: MicOff,
      iconClass: "text-red-500",
      bgClass: "bg-red-500/10",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      <div className="flex flex-col h-full px-6 py-8">
        <div className="space-y-1.5 mb-6">
          <p className="text-xs text-foreground/60 px-2 py-1 rounded-full bg-white/50 dark:bg-white/10 w-fit">
            Step 1 of 3
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Microphone Access
          </h2>
          <p className="text-sm text-foreground/60">
            Allow microphone access to enable voice input
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div
            className={cn(
              "h-28 w-28 rounded-full flex items-center justify-center transition-all glass-card",
              config.bgClass
            )}
            style={{
              boxShadow: isTestingMic
                ? `0 0 0 ${micLevel / 3}px rgba(34, 197, 94, 0.3)`
                : "none",
            }}
          >
            <Icon className={cn("h-12 w-12", config.iconClass)} />
          </div>

          {isTestingMic && (
            <p className="mt-4 text-sm text-foreground/60 animate-pulse">
              Speak to test your microphone...
            </p>
          )}

          {status === "granted" && !isTestingMic && testCompleted && (
            <p className="mt-4 text-sm text-green-600 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Microphone ready
            </p>
          )}

          {status === "denied" && (
            <div className="glass-card mt-6 p-4 rounded-2xl border-red-500/20 bg-red-500/5 max-w-xs">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Permission denied
                  </p>
                  <p className="text-xs text-foreground/60">
                    The browser test failed, but don't worry - WaveType uses
                    native audio capture which may still work.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === "pending" && (
            <div className="glass-card mt-6 p-4 rounded-2xl max-w-xs">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-foreground/60 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Native Audio Capture
                  </p>
                  <p className="text-xs text-foreground/60">
                    WaveType uses native audio capture. You can test your
                    microphone here or skip if the browser blocks access.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            className="glass-button flex-1 py-2.5 rounded-xl text-sm font-medium"
            onClick={onBack}
          >
            Back
          </button>
          {status === "granted" && !isTestingMic && testCompleted ? (
            <button
              onClick={onNext}
              className="glass-button flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
            >
              Continue
            </button>
          ) : status === "denied" ? (
            <div className="flex gap-2 flex-1">
              <button
                className="glass-button flex-1 py-2.5 rounded-xl text-sm font-medium"
                onClick={skipTest}
              >
                Skip Test
              </button>
              <button
                onClick={requestPermission}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-1">
              <button
                className="glass-button flex-1 py-2.5 rounded-xl text-sm font-medium"
                onClick={skipTest}
              >
                Skip
              </button>
              <button
                onClick={requestPermission}
                disabled={status === "checking"}
                className="glass-button flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25 disabled:opacity-50"
              >
                {status === "checking" ? "Checking..." : "Test Mic"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
