import { useAppStore } from "@/store";
import { CompleteStep } from "./complete-step";
import { HotkeyStep } from "./hotkey-step";
import { MicrophoneStep } from "./microphone-step";
import { ModelSelectStep } from "./model-select-step";
import { WelcomeStep } from "./welcome-step";

export function SetupWizard() {
  const { currentSetupStep, nextSetupStep, prevSetupStep, setSetupComplete } =
    useAppStore();

  const handleFinish = () => {
    setSetupComplete(true);
  };

  // Render the appropriate step based on currentSetupStep
  switch (currentSetupStep) {
    case 0:
      return <WelcomeStep onNext={nextSetupStep} />;
    case 1:
      return <MicrophoneStep onNext={nextSetupStep} onBack={prevSetupStep} />;
    case 2:
      return <ModelSelectStep onNext={nextSetupStep} onBack={prevSetupStep} />;
    case 3:
      return <HotkeyStep onNext={nextSetupStep} onBack={prevSetupStep} />;
    case 4:
      return <CompleteStep onFinish={handleFinish} />;
    default:
      return <WelcomeStep onNext={nextSetupStep} />;
  }
}
