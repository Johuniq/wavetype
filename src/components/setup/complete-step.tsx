import { Logo } from "@/components/logo";
import { useAppStore } from "@/store";
import { CheckCircle2, Cpu, Keyboard, Mic, Sparkles } from "lucide-react";

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
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      <div className="flex flex-col h-full min-h-0 px-6 py-8">
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-auto">
          <div className="h-14 w-14 rounded-full p-2 bg-green-500/10 flex items-center justify-center mb-4 glass-card">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>

          <Logo size="md" />

          <h2 className="text-lg font-semibold text-foreground mt-4">
            Setup Complete
          </h2>
          <p className="text-sm text-foreground/60 text-center mt-1">
            WaveType is ready to use
          </p>

          <div className="glass-card w-full mt-6 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/50 dark:bg-white/10">
                  <Mic className="h-4 w-4 text-foreground/60" />
                </div>
                <span className="text-sm text-foreground">Microphone</span>
              </div>
              <span className="text-sm text-green-500 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/50 dark:bg-white/10">
                  <Cpu className="h-4 w-4 text-foreground/60" />
                </div>
                <span className="text-sm text-foreground">Model</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {selectedModel?.name || "Base"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/50 dark:bg-white/10">
                  <Keyboard className="h-4 w-4 text-foreground/60" />
                </div>
                <span className="text-sm text-foreground">Hotkey</span>
              </div>
              <code className="text-sm font-mono text-foreground px-2 py-1 rounded-lg bg-white/50 dark:bg-white/10">
                {currentHotkey}
              </code>
            </div>
          </div>

          <div className="glass-card w-full my-3 p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-foreground/60" />
              <p className="text-sm font-medium text-foreground">How to use</p>
            </div>
            <ol className="text-xs text-foreground/70 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-white/50 dark:bg-white/10 flex items-center justify-center text-xs font-medium text-foreground shrink-0">
                  1
                </span>
                Click where you want to type
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-white/50 dark:bg-white/10 flex items-center justify-center text-xs font-medium text-foreground shrink-0">
                  2
                </span>
                {settings.hotkeyMode === "push-to-talk"
                  ? `Hold ${currentHotkey} and speak`
                  : `Press ${currentHotkey} to start`}
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-white/50 dark:bg-white/10 flex items-center justify-center text-xs font-medium text-foreground shrink-0">
                  3
                </span>
                {settings.hotkeyMode === "push-to-talk"
                  ? "Release to insert text"
                  : `Press ${currentHotkey} again to stop`}
              </li>
            </ol>
          </div>
        </div>

        <button
          onClick={onFinish}
          className="glass-button w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
        >
          <Sparkles className="h-4 w-4" />
          Start Using WaveType
        </button>
      </div>
    </div>
  );
}
