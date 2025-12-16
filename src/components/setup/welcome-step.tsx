import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      description: "English & Bangla support",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
        <Logo size="lg" />

        <p className="mt-3 text-muted-foreground text-center text-sm">
          Type anywhere with your voice
        </p>

        <div className="grid grid-cols-2 gap-3 mt-8 w-full">
          {features.map((feature) => (
            <Card key={feature.title} className="border-dashed">
              <CardContent className="p-4">
                <feature.icon className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button onClick={onNext} className="w-full" size="lg">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Takes about 2 minutes to set up
        </p>
      </div>
    </div>
  );
}
