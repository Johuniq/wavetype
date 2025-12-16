import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { AlertTriangle, Keyboard } from "lucide-react";
import { useState } from "react";

interface HotkeyStepProps {
  onNext: () => void;
  onBack: () => void;
}

type HotkeyMode = "push-to-talk" | "toggle";

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

export function HotkeyStep({ onNext, onBack }: HotkeyStepProps) {
  const { settings, updateSettings } = useAppStore();
  const [selectedMode, setSelectedMode] = useState<HotkeyMode>(
    settings.hotkeyMode
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
    <div className="flex flex-col h-full min-h-0 px-6 py-8">
      <div className="space-y-1.5 mb-6">
        <p className="text-xs text-muted-foreground">Step 3 of 3</p>
        <h2 className="text-lg font-semibold">Configure Hotkey</h2>
        <p className="text-sm text-muted-foreground">
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
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                selectedMode === option.mode
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <RadioGroupItem
                value={option.mode}
                id={option.mode}
                className="mt-0.5"
              />
              <div>
                <span className="font-medium text-sm">{option.title}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>
            </Label>
          ))}
        </RadioGroup>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Hotkey</span>
              <span className="text-xs text-muted-foreground">
                Click to change
              </span>
            </div>

            <button
              type="button"
              onClick={startRecordingHotkey}
              onKeyDown={handleKeyDown}
              onBlur={() => setIsRecordingHotkey(false)}
              className={cn(
                "w-full p-3 rounded-md border-2 border-dashed text-center transition-colors focus:outline-none",
                isRecordingHotkey
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              {isRecordingHotkey ? (
                <span className="text-sm text-primary">
                  {recordedKeys.length > 0
                    ? recordedKeys.join(" + ") + " ..."
                    : "Press a key combination..."}
                </span>
              ) : (
                <span className="text-sm font-mono font-medium">
                  {currentHotkey}
                </span>
              )}
            </button>

            {conflict && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{conflict}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Keyboard className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Use modifier keys (Ctrl, Alt, Shift) + a letter</p>
                <p>Avoid common shortcuts like Ctrl+C or Ctrl+V</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={conflict !== null}
          className="flex-1"
        >
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
