import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store";
import { CheckCircle2, Cpu, Keyboard, Mic } from "lucide-react";

interface CompleteStepProps {
  onFinish: () => void;
}

export function CompleteStep({ onFinish }: CompleteStepProps) {
  const { settings, selectedModel } = useAppStore();

  const currentHotkey =
    settings.hotkeyMode === "push-to-talk"
      ? settings.pushToTalkKey
      : settings.toggleKey;

  return (
    <div className="flex flex-col h-full min-h-0 px-6 py-8">
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-auto">
        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>

        <Logo size="md" />

        <h2 className="text-lg font-semibold mt-4">Setup Complete</h2>
        <p className="text-sm text-muted-foreground text-center mt-1">
          WaveType is ready to use
        </p>

        <Card className="w-full mt-6">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Microphone</span>
              </div>
              <span className="text-sm text-green-600 font-medium">
                Connected
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Model</span>
              </div>
              <span className="text-sm font-medium">
                {selectedModel?.name || "Base"}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Hotkey</span>
              </div>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {currentHotkey}
              </code>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full mt-3 bg-muted/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">How to use</p>
            <ol className="text-xs text-muted-foreground space-y-1.5">
              <li>1. Click where you want to type</li>
              <li>
                2.{" "}
                {settings.hotkeyMode === "push-to-talk"
                  ? `Hold ${currentHotkey} and speak`
                  : `Press ${currentHotkey} to start`}
              </li>
              <li>
                3.{" "}
                {settings.hotkeyMode === "push-to-talk"
                  ? "Release to insert text"
                  : `Press ${currentHotkey} again to stop`}
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <Button onClick={onFinish} className="w-full" size="lg">
        Start Using WaveType
      </Button>
    </div>
  );
}
