import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  formatProgress,
  getCurrentVersion,
  relaunchApp,
  type UpdateProgress,
  type UpdateStatus,
} from "@/lib/updater-api";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function UpdaterView() {
  const [status, setStatus] = useState<UpdateStatus>({ status: "idle" });
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const { success: toastSuccess, error: toastError } = useToast();

  useEffect(() => {
    getCurrentVersion().then(setCurrentVersion);
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    setStatus({ status: "checking" });
    const result = await checkForUpdates();
    setStatus(result);

    if (result.status === "available") {
      toastSuccess(`Update ${result.info.version} available!`);
    } else if (result.status === "not-available") {
      toastSuccess("You're running the latest version");
    } else if (result.status === "error") {
      toastError(result.message);
    }
  }, [toastSuccess, toastError]);

  const handleDownloadAndInstall = useCallback(async () => {
    setStatus({
      status: "downloading",
      progress: { downloaded: 0, total: null },
    });
    setProgress({ downloaded: 0, total: null });

    const result = await downloadAndInstallUpdate((p) => {
      setProgress(p);
      setStatus({ status: "downloading", progress: p });
    });

    setStatus(result);

    if (result.status === "ready") {
      toastSuccess("Update downloaded! Click 'Restart' to apply.");
    } else if (result.status === "error") {
      toastError(result.message);
    }
  }, [toastSuccess, toastError]);

  const handleRelaunch = useCallback(async () => {
    try {
      await relaunchApp();
    } catch (error) {
      toastError("Failed to restart application");
    }
  }, [toastError]);

  const getStatusIcon = () => {
    switch (status.status) {
      case "checking":
        return (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        );
      case "available":
        return <Sparkles className="h-5 w-5 text-yellow-500" />;
      case "not-available":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "downloading":
        return <Download className="h-5 w-5 text-blue-500 animate-bounce" />;
      case "ready":
        return <Rocket className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusMessage = () => {
    switch (status.status) {
      case "idle":
        return "Click to check for updates";
      case "checking":
        return "Checking for updates...";
      case "available":
        return `Version ${status.info.version} is available`;
      case "not-available":
        return "You're running the latest version";
      case "downloading":
        return progress ? formatProgress(progress) : "Downloading...";
      case "ready":
        return "Update ready! Restart to apply";
      case "error":
        return status.message;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-base">Software Updates</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            v{currentVersion}
          </Badge>
        </div>
        <CardDescription>{getStatusMessage()}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar for downloading */}
        {status.status === "downloading" && progress && (
          <div className="space-y-2">
            <Progress
              value={
                progress.total
                  ? (progress.downloaded / progress.total) * 100
                  : undefined
              }
              className="h-2"
            />
          </div>
        )}

        {/* Release notes */}
        {(status.status === "available" || status.status === "ready") &&
          status.info.body && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">What's new:</p>
              <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">
                {status.info.body}
              </p>
            </div>
          )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {status.status === "idle" ||
          status.status === "not-available" ||
          status.status === "error" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckForUpdates}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Updates
            </Button>
          ) : null}

          {status.status === "checking" && (
            <Button variant="outline" size="sm" disabled className="flex-1">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </Button>
          )}

          {status.status === "available" && (
            <Button
              size="sm"
              onClick={handleDownloadAndInstall}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download & Install
            </Button>
          )}

          {status.status === "ready" && (
            <Button size="sm" onClick={handleRelaunch} className="flex-1">
              <Rocket className="h-4 w-4 mr-2" />
              Restart Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
