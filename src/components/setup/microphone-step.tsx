import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  // Skip microphone test - the actual recording uses Rust/cpal
  const skipTest = () => {
    setStatus("granted");
    setTestCompleted(true);
  };

  const statusConfig = {
    pending: {
      icon: Mic,
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    checking: {
      icon: Loader2,
      iconClass: "text-primary animate-spin",
      bgClass: "bg-primary/10",
    },
    granted: {
      icon: CheckCircle2,
      iconClass: "text-green-600",
      bgClass: "bg-green-500/10",
    },
    denied: {
      icon: MicOff,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="space-y-1.5 mb-6">
        <p className="text-xs text-muted-foreground">Step 1 of 3</p>
        <h2 className="text-lg font-semibold">Microphone Access</h2>
        <p className="text-sm text-muted-foreground">
          Allow microphone access to enable voice input
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className={cn(
            "h-24 w-24 rounded-full flex items-center justify-center transition-all",
            config.bgClass
          )}
          style={{
            boxShadow: isTestingMic
              ? `0 0 0 ${micLevel / 4}px hsl(var(--primary) / 0.2)`
              : "none",
          }}
        >
          <Icon className={cn("h-10 w-10", config.iconClass)} />
        </div>

        {isTestingMic && (
          <p className="mt-4 text-sm text-muted-foreground animate-pulse">
            Speak to test your microphone...
          </p>
        )}

        {status === "granted" && !isTestingMic && testCompleted && (
          <p className="mt-4 text-sm text-green-600 font-medium">
            Microphone ready
          </p>
        )}

        {status === "denied" && (
          <Card className="mt-6 border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Permission denied</p>
                  <p className="text-xs text-muted-foreground">
                    The browser test failed, but don't worry - WaveType uses
                    native audio capture which may still work.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "pending" && (
          <Card className="mt-6 border-border bg-muted/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Native Audio Capture</p>
                  <p className="text-xs text-muted-foreground">
                    WaveType uses native audio capture. You can test your
                    microphone here or skip if the browser blocks access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        {status === "granted" && !isTestingMic && testCompleted ? (
          <Button onClick={onNext} className="flex-1">
            Continue
          </Button>
        ) : status === "denied" ? (
          <div className="flex gap-2 flex-1">
            <Button variant="outline" onClick={skipTest} className="flex-1">
              Skip Test
            </Button>
            <Button onClick={requestPermission} className="flex-1">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 flex-1">
            <Button variant="outline" onClick={skipTest} className="flex-1">
              Skip
            </Button>
            <Button
              onClick={requestPermission}
              disabled={status === "checking"}
              className="flex-1"
            >
              {status === "checking" ? "Checking..." : "Test Mic"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
