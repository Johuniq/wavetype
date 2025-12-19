import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activateLicense,
  deactivateLicense,
  formatExpirationDate,
  getLicense,
  getLicenseStatusMessage,
  isLicenseActive,
  maskLicenseKey,
  validateLicense,
  type LicenseData,
} from "@/lib/license-api";
import { openUrl } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Key,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface LicenseViewProps {
  onClose: () => void;
  onLicenseChange?: (isValid: boolean) => void;
}

export function LicenseView({ onClose, onLicenseChange }: LicenseViewProps) {
  const [license, setLicense] = useState<LicenseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      onLicenseChange?.(data.is_activated && data.status === "active");
    } catch (err) {
      console.error("Failed to load license:", err);
      setError("Failed to load license information");
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
      onLicenseChange?.(data.is_activated && data.status === "active");
    } catch (err) {
      console.error("Failed to activate license:", err);
      setError(
        err instanceof Error ? err.message : "Failed to activate license"
      );
    } finally {
      setIsActivating(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await validateLicense();
      setLicense(data);
      if (data.is_activated && data.status === "active") {
        setSuccess("License validated successfully!");
      } else {
        setError(getLicenseStatusMessage(data.status));
      }
      onLicenseChange?.(data.is_activated && data.status === "active");
    } catch (err) {
      console.error("Failed to validate license:", err);
      setError(
        err instanceof Error ? err.message : "Failed to validate license"
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    setError(null);
    setSuccess(null);

    try {
      await deactivateLicense();
      // Reload license from database to get the correct status
      // Status will be "trial_expired" if user had a trial, or "inactive" if not
      const updatedLicense = await getLicense();
      setLicense(updatedLicense);

      const hadTrial = updatedLicense.trial_started_at !== null;
      const message = hadTrial
        ? "License deactivated. Your trial has already been used."
        : "License deactivated. You can reactivate on this or another device.";
      setSuccess(message);
      onLicenseChange?.(false);
    } catch (err) {
      console.error("Failed to deactivate license:", err);
      setError(
        err instanceof Error ? err.message : "Failed to deactivate license"
      );
    } finally {
      setIsDeactivating(false);
    }
  };

  const isActive = license ? isLicenseActive(license.status) : false;
  const isTrial = license?.status === "trial";
  const isTrialExpired = license?.status === "trial_expired";
  const trialDaysRemaining = license?.trial_days_remaining;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      {/* Glass Header */}
      <div className="liquid-glass border-b border-white/20 dark:border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onClose}
          className="glass-icon-button p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-foreground/70" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">License</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
              <p className="text-sm text-foreground/60">
                Loading license info...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div className="glass-card p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
                    <Shield className="h-4 w-4 text-foreground/60" />
                  </div>
                  <h2 className="font-semibold text-sm text-foreground">
                    License Status
                  </h2>
                </div>
                {isTrial ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    Trial
                  </span>
                ) : isTrialExpired ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    Trial Expired
                  </span>
                ) : isActive ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/30 dark:bg-white/10 text-muted-foreground text-xs font-medium">
                    <ShieldX className="h-3.5 w-3.5" />
                    Inactive
                  </span>
                )}
              </div>

              {/* Trial info */}
              {isTrial &&
                trialDaysRemaining !== null &&
                trialDaysRemaining !== undefined && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        {trialDaysRemaining} day
                        {trialDaysRemaining !== 1 ? "s" : ""} remaining
                      </span>
                    </div>
                    <p className="text-xs text-foreground/60 mt-1">
                      Purchase a license to unlock unlimited use
                    </p>
                  </div>
                )}

              {/* Trial expired info */}
              {isTrialExpired && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                      Your trial has expired
                    </span>
                  </div>
                  <p className="text-xs text-foreground/60 mt-1">
                    Purchase a license to continue using WaveType
                  </p>
                </div>
              )}

              {license?.license_key && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
                    <span className="text-xs text-foreground/60">
                      License Key
                    </span>
                    <code className="text-xs font-mono text-foreground/80">
                      {maskLicenseKey(license.license_key)}
                    </code>
                  </div>
                  {license.customer_email && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
                      <span className="text-xs text-foreground/60">Email</span>
                      <span className="text-sm text-foreground/80">
                        {license.customer_email}
                      </span>
                    </div>
                  )}
                  {license.customer_name && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
                      <span className="text-xs text-foreground/60">Name</span>
                      <span className="text-sm text-foreground/80">
                        {license.customer_name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
                    <span className="text-xs text-foreground/60">
                      Expiration
                    </span>
                    <span className="text-sm text-foreground/80">
                      {formatExpirationDate(license.expires_at)}
                    </span>
                  </div>
                  {license.last_validated_at && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/10">
                      <span className="text-xs text-foreground/60">
                        Last Validated
                      </span>
                      <span className="text-sm text-foreground/80">
                        {new Date(
                          license.last_validated_at
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!license?.license_key && !isTrial && (
                <p className="text-sm text-foreground/70 p-3 rounded-xl bg-white/30 dark:bg-white/10">
                  No license activated. Enter your license key below to unlock
                  all features.
                </p>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="glass-card p-3 rounded-2xl border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {success && (
              <div className="glass-card p-3 rounded-2xl border-green-500/30 bg-green-500/10 flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Activate License */}
            {(!isActive || isTrial) && !license?.license_key && (
              <div className="glass-card p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
                    <Key className="h-4 w-4 text-foreground/60" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm text-foreground">
                      {isTrial ? "Upgrade to Pro" : "Activate License"}
                    </h2>
                    <p className="text-xs text-foreground/60">
                      {isTrial
                        ? "Enter your license key to unlock unlimited access"
                        : "Enter your license key to activate WaveType Pro"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label
                      htmlFor="license-key"
                      className="text-xs font-medium text-foreground/60 uppercase tracking-wider"
                    >
                      License Key
                    </Label>
                    <Input
                      id="license-key"
                      placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      disabled={isActivating}
                      className="bg-white/30 dark:bg-white/5 border-white/30 dark:border-white/10 rounded-xl"
                    />
                  </div>
                  <button
                    className="w-full py-2.5 rounded-xl flex items-center glass-button justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleActivate}
                    disabled={isActivating || !licenseKey.trim()}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        Activate License
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Manage License */}
            {license?.license_key && (
              <div className="glass-card p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
                    <RefreshCw className="h-4 w-4 text-foreground/60" />
                  </div>
                  <h2 className="font-semibold text-sm text-foreground">
                    Manage License
                  </h2>
                </div>

                <div className="space-y-2">
                  <button
                    className="glass-button w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium"
                    onClick={handleValidate}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Validate License
                      </>
                    )}
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
                        disabled={isDeactivating}
                      >
                        {isDeactivating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Deactivating...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Deactivate License
                          </>
                        )}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-card border-0">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate License?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will deactivate your license on this device. You
                          can reactivate it later or activate it on another
                          device.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="glass-button">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeactivate}
                          className="bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600"
                        >
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Buy License - Only show when user doesn't have active license */}
            {(!isActive || isTrial || isTrialExpired) && (
              <div className="glass-card p-4 rounded-2xl overflow-hidden relative">
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
                      <Sparkles className="h-4 w-4 text-foreground/60" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm text-foreground">
                        {isTrial || isTrialExpired
                          ? "Upgrade to Pro"
                          : "Get WaveType Pro"}
                      </h2>
                      <p className="text-xs text-foreground/60">
                        {isTrial
                          ? "Continue using WaveType after your trial ends"
                          : isTrialExpired
                          ? "Your trial has ended - purchase to continue"
                          : "Unlock all features with a Pro license"}
                      </p>
                    </div>
                  </div>

                  <button
                    className="glass-button w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
                    onClick={() => openUrl("https://polar.sh/johuniq/wavetype")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isTrial || isTrialExpired
                      ? "Upgrade Now"
                      : "Purchase License"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
