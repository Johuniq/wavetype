import {
  activateLicense,
  getLicense,
  isLicenseActive,
  startTrial,
  type LicenseData,
} from "@/lib/license-api";
import { cn, openUrl } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  ExternalLink,
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
      <div className="relative flex flex-col items-center justify-center h-full overflow-hidden">
        {/* Background mesh gradient */}
        <div className="glass-mesh-bg" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/30 dark:bg-white/10 backdrop-blur-xl border border-white/30 flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
          </div>
          <p className="text-sm text-foreground/60 font-medium">
            Checking license...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      <div className="relative z-10 flex-1 flex flex-col px-6 py-8">
        <div className="flex-1 flex flex-col max-w-sm w-full mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/30 dark:bg-white/10 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-lg">
              <Key className="h-8 w-8 text-foreground/60" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Activate WaveType
            </h2>
            <p className="text-sm text-foreground/60 mt-2">
              {showActivationForm
                ? "Enter your license key to activate"
                : "Choose how you'd like to get started"}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 pt-1">
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 pt-1">
                {success}
              </p>
            </div>
          )}

          {/* Already active/trial status */}
          {canProceed && !success && (
            <div className="mb-4 p-4 rounded-2xl bg-green-500/10 backdrop-blur-xl border border-green-500/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {isTrial ? "Trial Active" : "License Active"}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {isTrial
                      ? `${license?.trial_days_remaining ?? 7} days remaining`
                      : "Your license is activated"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main content - options or activation form */}
          {!showActivationForm ? (
            <div className="space-y-3 flex-1">
              {/* Trial Option */}
              <button
                onClick={handleStartTrial}
                disabled={isStartingTrial}
                className={cn(
                  "w-full p-4 rounded-2xl text-left transition-all duration-200",
                  "bg-white/40 dark:bg-white/5 backdrop-blur-xl",
                  "border border-white/50 dark:border-white/10",
                  "hover:bg-white/60 dark:hover:bg-white/10 hover:border-foreground/30",
                  "hover:shadow-lg",
                  "group"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {isStartingTrial ? (
                      <Loader2 className="h-6 w-6 animate-spin text-foreground/60" />
                    ) : (
                      <Clock className="h-6 w-6 text-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">
                      Start 7-Day Free Trial
                    </h3>
                    <p className="text-xs text-foreground/60 mt-1">
                      Try all features free for 7 days. No credit card required.
                    </p>
                  </div>
                </div>
              </button>

              {/* License Activation Option */}
              <button
                onClick={() => setShowActivationForm(true)}
                className={cn(
                  "w-full p-4 rounded-2xl text-left transition-all duration-200",
                  "bg-white/40 dark:bg-white/5 backdrop-blur-xl",
                  "border border-white/50 dark:border-white/10",
                  "hover:bg-white/60 dark:hover:bg-white/10 hover:border-foreground/30",
                  "hover:shadow-lg",
                  "group"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Key className="h-6 w-6 text-foreground/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">
                      I Have a License Key
                    </h3>
                    <p className="text-xs text-foreground/60 mt-1">
                      Already purchased? Enter your license key to activate.
                    </p>
                  </div>
                </div>
              </button>

              {/* Purchase link */}
              <div className="pt-4 text-center">
                <button
                  onClick={() => openUrl("https://polar.sh/johuniq/wavetype")}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Purchase a license
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            /* License activation form */
            <div className="space-y-4 flex-1">
              <div className="p-5 rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground">
                    Enter License Key
                  </h3>
                  <p className="text-xs text-foreground/60 mt-1">
                    Your license key was sent to your email after purchase
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="license-key"
                      className="text-sm font-medium text-foreground/80"
                    >
                      License Key
                    </label>
                    <input
                      id="license-key"
                      type="text"
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      disabled={isActivating}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl font-mono text-sm",
                        "bg-white/50 dark:bg-white/5",
                        "border border-white/50 dark:border-white/20",
                        "focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:border-foreground/30",
                        "placeholder:text-gray-400 dark:placeholder:text-gray-600",
                        "disabled:opacity-50"
                      )}
                    />
                  </div>

                  <button
                    onClick={handleActivate}
                    disabled={isActivating || !licenseKey.trim()}
                    className={cn(
                      "w-full py-3 px-6 rounded-xl font-semibold",
                      "bg-foreground/90 hover:bg-foreground",
                      "text-white shadow-lg shadow-foreground/25",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all duration-200",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Activate License
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowActivationForm(false)}
                className={cn(
                  "w-full py-3 px-6 rounded-xl font-medium",
                  "bg-white/30 dark:bg-white/10 backdrop-blur-xl",
                  "border border-white/50 dark:border-white/10",
                  "text-foreground/80",
                  "hover:bg-white/50 dark:hover:bg-white/15",
                  "transition-all duration-200"
                )}
              >
                Back to options
              </button>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 max-w-sm w-full mx-auto pt-4">
          <button
            onClick={onBack}
            className={cn(
              "flex-1 py-3 px-6 rounded-xl font-medium",
              "bg-white/30 dark:bg-white/10 backdrop-blur-xl",
              "border border-white/50 dark:border-white/10",
              "text-foreground/80",
              "hover:bg-white/50 dark:hover:bg-white/15",
              "transition-all duration-200",
              "flex items-center justify-center gap-2"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {canProceed && (
            <button
              onClick={onNext}
              className={cn(
                "flex-1 py-3 px-6 rounded-xl font-semibold",
                "bg-foreground/90 hover:bg-foreground",
                "text-white shadow-lg shadow-foreground/25",
                "transition-all duration-200",
                "flex items-center justify-center gap-2"
              )}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
