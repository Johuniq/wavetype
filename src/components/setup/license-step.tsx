import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activateLicense,
  getLicense,
  isLicenseActive,
  startTrial,
  type LicenseData,
} from "@/lib/license-api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Key,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

interface LicenseStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function LicenseStep({ onNext, onBack }: LicenseStepProps) {
  const [license, setLicense] = useState<LicenseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showActivationForm, setShowActivationForm] = useState(false);

  // Load license on mount
  useEffect(() => {
    loadLicense();
  }, []);

  const loadLicense = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLicense();
      setLicense(data);
    } catch (err) {
      console.error("Failed to load license:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setIsActivating(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await activateLicense(licenseKey.trim());
      setLicense(data);
      setLicenseKey("");
      setSuccess("License activated successfully!");
      // Auto proceed after successful activation
      setTimeout(() => {
        onNext();
      }, 1500);
    } catch (err) {
      console.error("Failed to activate license:", err);
      setError(
        err instanceof Error ? err.message : "Failed to activate license"
      );
    } finally {
      setIsActivating(false);
    }
  };

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await startTrial();
      setLicense(data);
      setSuccess("7-day trial started!");
      // Auto proceed after starting trial
      setTimeout(() => {
        onNext();
      }, 1500);
    } catch (err) {
      console.error("Failed to start trial:", err);
      setError(err instanceof Error ? err.message : "Failed to start trial");
    } finally {
      setIsStartingTrial(false);
    }
  };

  const isActive = license ? isLicenseActive(license.status) : false;
  const isTrial = license?.status === "trial";

  // If already activated or in trial, allow to continue
  const canProceed = isActive || isTrial;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Checking license...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Activate WaveType</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {showActivationForm
              ? "Enter your license key to activate"
              : "Choose how you'd like to get started"}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Already active/trial status */}
        {canProceed && !success && (
          <Card className="mb-4 border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-600">
                    {isTrial ? "Trial Active" : "License Active"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isTrial
                      ? `${license?.trial_days_remaining ?? 7} days remaining`
                      : "Your license is activated"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content - options or activation form */}
        {!showActivationForm ? (
          <div className="space-y-3 flex-1">
            {/* Trial Option */}
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={handleStartTrial}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">Start 7-Day Free Trial</h3>
                      {isStartingTrial && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try all features free for 7 days. No credit card required.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* License Activation Option */}
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setShowActivationForm(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">I Have a License Key</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Already purchased? Enter your license key to activate.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase link */}
            <div className="pt-4 text-center">
              <a
                href="https://polar.sh/wavetype"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Sparkles className="h-4 w-4" />
                Purchase a license
              </a>
            </div>
          </div>
        ) : (
          /* License activation form */
          <div className="space-y-4 flex-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enter License Key</CardTitle>
                <CardDescription className="text-xs">
                  Your license key was sent to your email after purchase
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="license-key" className="text-sm">
                    License Key
                  </Label>
                  <Input
                    id="license-key"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    className="font-mono text-sm"
                    disabled={isActivating}
                  />
                </div>

                <Button
                  onClick={handleActivate}
                  disabled={isActivating || !licenseKey.trim()}
                  className="w-full"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Activate License
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Button
              variant="ghost"
              onClick={() => setShowActivationForm(false)}
              className="w-full"
            >
              Back to options
            </Button>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 max-w-sm w-full mx-auto">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {canProceed && (
          <Button onClick={onNext} className="flex-1">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
