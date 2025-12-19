import { Logo } from "@/components/logo";
import { ArrowRight, Globe, Keyboard, Mic, Zap } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const features = [
    {
      icon: Mic,
      title: "Voice Input",
      description: "Natural speech to text",
    },
    {
      icon: Keyboard,
      title: "Universal",
      description: "Works in any application",
    },
    {
      icon: Zap,
      title: "Fast & Private",
      description: "Offline AI processing",
    },
    {
      icon: Globe,
      title: "Multi-language",
      description: "99+ language support",
    },
  ];

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
          <Logo size="lg" />

          <p className="mt-3 text-foreground/60 text-center text-sm">
            Type anywhere with your voice
          </p>

          <div className="grid grid-cols-2 gap-3 mt-8 w-full">
            {features.map((feature) => (
              <div key={feature.title} className="glass-card p-4 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-white/30 dark:bg-white/10 flex items-center justify-center mb-3">
                  <feature.icon className="h-5 w-5 text-foreground/60" />
                </div>
                <p className="font-medium text-sm text-foreground">
                  {feature.title}
                </p>
                <p className="text-xs text-foreground/60 mt-0.5">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-sm space-y-3">
          <button
            onClick={onNext}
            className="glass-button w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-foreground/60 text-center">
            Takes about 2 minutes to set up
          </p>
        </div>
      </div>
    </div>
  );
}
