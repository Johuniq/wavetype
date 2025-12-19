import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { AlertTriangle, Clipboard, Keyboard, Type } from "lucide-react";
import { useState } from "react";

interface HotkeyStepProps {
  onNext: () => void;
  onBack: () => void;
}

type HotkeyMode = "push-to-talk" | "toggle";
type OutputMode = "inject" | "clipboard";

const hotkeyOptions = [
  {
    mode: "push-to-talk" as const,
    title: "Push to Talk",
    description: "Hold key to record, release to transcribe",
    defaultKey: "Ctrl+Shift+R",
  },
  {
    mode: "toggle" as const,
    title: "Toggle Mode",
    description: "Press to start/stop recording",
    defaultKey: "Ctrl+Shift+T",
  },
];

const outputOptions = [
  {
    mode: "inject" as const,
    title: "Type Text",
    description: "Automatically type text where your cursor is",
    icon: Type,
  },
  {
    mode: "clipboard" as const,
    title: "Copy to Clipboard",
    description: "Copy text to clipboard for manual pasting",
    icon: Clipboard,
  },
];

export function HotkeyStep({ onNext, onBack }: HotkeyStepProps) {
  const { settings, updateSettings } = useAppStore();
  const [selectedMode, setSelectedMode] = useState<HotkeyMode>(
    settings.hotkeyMode
  );
  const [selectedOutputMode, setSelectedOutputMode] = useState<OutputMode>(
    settings.clipboardMode ? "clipboard" : "inject"
  );
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [customHotkey, setCustomHotkey] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const currentHotkey =
    customHotkey ||
    (selectedMode === "push-to-talk"
      ? settings.pushToTalkKey
      : settings.toggleKey);

  const startRecordingHotkey = () => {
    setIsRecordingHotkey(true);
    setRecordedKeys([]);
    setConflict(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecordingHotkey) return;

    e.preventDefault();
    e.stopPropagation();

    const key = e.key;
    const modifiers: string[] = [];

    if (e.ctrlKey) modifiers.push("Ctrl");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");
    if (e.metaKey) modifiers.push("Meta");

    if (["Control", "Alt", "Shift", "Meta"].includes(key)) {
      setRecordedKeys(modifiers);
      return;
    }

    const displayKey = key.length === 1 ? key.toUpperCase() : key;
    const fullHotkey = [...modifiers, displayKey].join("+");

    setRecordedKeys([...modifiers, displayKey]);

    const conflictingShortcuts: Record<string, string> = {
      "Ctrl+C": "Copy",
      "Ctrl+V": "Paste",
      "Ctrl+X": "Cut",
      "Ctrl+Z": "Undo",
      "Ctrl+S": "Save",
      "Alt+Tab": "Switch Window",
      "Alt+F4": "Close Window",
    };

    if (conflictingShortcuts[fullHotkey]) {
      setConflict(`Conflicts with "${conflictingShortcuts[fullHotkey]}"`);
    } else {
      setConflict(null);
      setCustomHotkey(fullHotkey);
    }

    setIsRecordingHotkey(false);
  };

  const handleContinue = () => {
    const newSettings: Partial<typeof settings> = {
      hotkeyMode: selectedMode,
      clipboardMode: selectedOutputMode === "clipboard",
    };

    if (customHotkey) {
      if (selectedMode === "push-to-talk") {
        newSettings.pushToTalkKey = customHotkey;
      } else {
        newSettings.toggleKey = customHotkey;
      }
    }

    updateSettings(newSettings);
    onNext();
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      <div className="flex flex-col h-full min-h-0 px-6 py-8">
        <div className="space-y-1.5 mb-6">
          <p className="text-xs text-foreground/60 px-2 py-1 rounded-full bg-white/50 dark:bg-white/10 w-fit">
            Step 3 of 3
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Configure Hotkey
          </h2>
          <p className="text-sm text-foreground/60">
            Choose how to activate voice typing
          </p>
        </div>

        <div className="flex-1 overflow-auto min-h-0 space-y-4">
          <RadioGroup
            value={selectedMode}
            onValueChange={(v) => {
              setSelectedMode(v as HotkeyMode);
              setCustomHotkey(null);
              setConflict(null);
            }}
            className="space-y-2"
          >
            {hotkeyOptions.map((option) => (
              <Label
                key={option.mode}
                htmlFor={option.mode}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all glass-card",
                  selectedMode === option.mode &&
                    "ring-2 ring-foreground/30 border-foreground/20 bg-foreground/5"
                )}
              >
                <RadioGroupItem
                  value={option.mode}
                  id={option.mode}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium text-sm text-foreground">
                    {option.title}
                  </span>
                  <p className="text-xs text-foreground/60 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </Label>
            ))}
          </RadioGroup>

          <div className="glass-card p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Hotkey
              </span>
              <span className="text-xs text-foreground/60">
                Click to change
              </span>
            </div>

            <button
              type="button"
              onClick={startRecordingHotkey}
              onKeyDown={handleKeyDown}
              onBlur={() => setIsRecordingHotkey(false)}
              className={cn(
                "w-full p-3 rounded-xl border-2 border-dashed text-center transition-all focus:outline-none",
                "bg-white/30 dark:bg-white/10",
                isRecordingHotkey
                  ? "border-foreground/50 bg-foreground/5"
                  : "border-white/30 dark:border-white/10 hover:border-foreground/30"
              )}
            >
              {isRecordingHotkey ? (
                <span className="text-sm text-foreground/60">
                  {recordedKeys.length > 0
                    ? recordedKeys.join(" + ") + " ..."
                    : "Press a key combination..."}
                </span>
              ) : (
                <span className="text-sm font-mono font-medium text-foreground">
                  {currentHotkey}
                </span>
              )}
            </button>

            {conflict && (
              <div className="flex items-center gap-2 text-sm text-amber-600 p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4" />
                <span>{conflict}</span>
              </div>
            )}
          </div>

          <div className="glass-card p-4 rounded-2xl">
            <div className="flex items-start gap-2">
              <Keyboard className="h-4 w-4 text-foreground/60 mt-0.5" />
              <div className="text-xs text-foreground/60 space-y-1">
                <p>Use modifier keys (Ctrl, Alt, Shift) + a letter</p>
                <p>Avoid common shortcuts like Ctrl+C or Ctrl+V</p>
              </div>
            </div>
          </div>

          {/* Output Mode Selection */}
          <div className="space-y-2">
            <span className="text-sm mb-2 font-medium text-foreground">
              Output Mode
            </span>
            <RadioGroup
              value={selectedOutputMode}
              onValueChange={(v) => setSelectedOutputMode(v as OutputMode)}
              className="space-y-2 mt-2"
            >
              {outputOptions.map((option) => (
                <Label
                  key={option.mode}
                  htmlFor={`output-${option.mode}`}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all glass-card",
                    selectedOutputMode === option.mode &&
                      "ring-2 ring-foreground/30 border-foreground/20 bg-foreground/5"
                  )}
                >
                  <RadioGroupItem
                    value={option.mode}
                    id={`output-${option.mode}`}
                    className="mt-0.5"
                  />
                  <div className="p-2 rounded-lg bg-white/30 dark:bg-white/10">
                    <option.icon className="h-4 w-4 text-foreground/60" />
                  </div>
                  <div>
                    <span className="font-medium text-sm text-foreground">
                      {option.title}
                    </span>
                    <p className="text-xs text-foreground/60 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/10 mt-4">
          <button
            className="glass-button py-2.5 px-4 rounded-xl text-sm font-medium"
            onClick={onBack}
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={conflict !== null}
            className="glass-button flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25 disabled:opacity-50"
          >
            Complete Setup
          </button>
        </div>
      </div>
    </div>
  );
}
