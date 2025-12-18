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
        return <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />;
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
        return <RefreshCw className="h-5 w-5 text-foreground/60" />;
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
    <div className="glass-card p-4 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/30 dark:bg-white/10">
            {getStatusIcon()}
          </div>
          <div>
            <h2 className="font-semibold text-sm text-foreground">
              Software Updates
            </h2>
            <p className="text-xs text-foreground/60">{getStatusMessage()}</p>
          </div>
        </div>
        <span className="px-2 py-1 rounded-lg bg-white/50 dark:bg-white/10 border border-white/30 dark:border-white/10 font-mono text-xs text-foreground/60">
          v{currentVersion}
        </span>
      </div>

      {/* Progress bar for downloading */}
      {status.status === "downloading" && progress && (
        <div className="mb-3">
          <div className="h-2 bg-white/30 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground/80 transition-all duration-300 rounded-full"
              style={{
                width: progress.total
                  ? `${(progress.downloaded / progress.total) * 100}%`
                  : "50%",
              }}
            />
          </div>
        </div>
      )}

      {/* Release notes */}
      {(status.status === "available" || status.status === "ready") &&
        status.info.body && (
          <div className="rounded-xl bg-white/30 dark:bg-white/10 border border-white/30 dark:border-white/10 p-3 mb-3">
            <p className="font-medium text-xs text-foreground mb-1">
              What's new:
            </p>
            <p className="text-xs text-foreground/70 whitespace-pre-wrap line-clamp-4">
              {status.info.body}
            </p>
          </div>
        )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {status.status === "idle" ||
        status.status === "not-available" ||
        status.status === "error" ? (
          <button
            onClick={handleCheckForUpdates}
            className="glass-button flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Check for Updates
          </button>
        ) : null}

        {status.status === "checking" && (
          <button
            disabled
            className="glass-button flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium opacity-70 cursor-not-allowed"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking...
          </button>
        )}

        {status.status === "available" && (
          <button
            onClick={handleDownloadAndInstall}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
          >
            <Download className="h-4 w-4" />
            Download & Install
          </button>
        )}

        {status.status === "ready" && (
          <button
            onClick={handleRelaunch}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white bg-foreground/90 hover:bg-foreground transition-all shadow-lg shadow-foreground/25"
          >
            <Rocket className="h-4 w-4" />
            Restart Now
          </button>
        )}
      </div>
    </div>
  );
}
