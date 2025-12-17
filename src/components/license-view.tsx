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
  deactivateLicense,
  formatExpirationDate,
  getLicense,
  getLicenseStatusMessage,
  isLicenseActive,
  maskLicenseKey,
  validateLicense,
  type LicenseData,
} from "@/lib/license-api";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Key,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldX,
  Trash2,
  User,
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
      setLicense({
        license_key: null,
        activation_id: null,
        status: "inactive",
        customer_email: null,
        customer_name: null,
        expires_at: null,
        is_activated: false,
        last_validated_at: null,
        trial_started_at: null,
        trial_days_remaining: null,
      });
      setSuccess("License deactivated successfully");
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
  const trialDaysRemaining = license?.trial_days_remaining;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">License</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">License Status</CardTitle>
                  {isTrial ? (
                    <div className="flex items-center gap-1.5 text-amber-500">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Trial</span>
                    </div>
                  ) : isActive ? (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldX className="h-4 w-4" />
                      <span className="text-sm font-medium">Inactive</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Trial info */}
                {isTrial &&
                  trialDaysRemaining !== null &&
                  trialDaysRemaining !== undefined && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          {trialDaysRemaining} day
                          {trialDaysRemaining !== 1 ? "s" : ""} remaining
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Purchase a license to unlock unlimited use
                      </p>
                    </div>
                  )}

                {license?.license_key && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">License Key</span>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {maskLicenseKey(license.license_key)}
                      </code>
                    </div>
                    {license.customer_email && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Email</span>
                        <span>{license.customer_email}</span>
                      </div>
                    )}
                    {license.customer_name && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Name</span>
                        <span>{license.customer_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expiration</span>
                      <span>{formatExpirationDate(license.expires_at)}</span>
                    </div>
                    {license.last_validated_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Last Validated
                        </span>
                        <span>
                          {new Date(
                            license.last_validated_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {!license?.license_key && !isTrial && (
                  <p className="text-sm text-muted-foreground">
                    No license activated. Enter your license key below to unlock
                    all features.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg text-sm">
                <Check className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Activate License - show for trial users or inactive */}
            {(!isActive || isTrial) && !license?.license_key && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {isTrial ? "Upgrade to Pro" : "Activate License"}
                  </CardTitle>
                  <CardDescription>
                    {isTrial
                      ? "Enter your license key to unlock unlimited access"
                      : "Enter your license key to activate WaveType Pro"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="license-key">License Key</Label>
                    <Input
                      id="license-key"
                      placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      disabled={isActivating}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleActivate}
                    disabled={isActivating || !licenseKey.trim()}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Activate License
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Manage License */}
            {license?.license_key && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Manage License</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleValidate}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Validate License
                      </>
                    )}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={isDeactivating}
                      >
                        {isDeactivating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deactivating...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deactivate License
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate License?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will deactivate your license on this device. You
                          can reactivate it later or activate it on another
                          device.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeactivate}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}

            {/* Buy License */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Get WaveType Pro</CardTitle>
                <CardDescription>
                  Unlock all features with a Pro license
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Open Polar checkout page
                    window.open("https://polar.sh/johuniq/wavetype", "_blank");
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  Purchase License
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
