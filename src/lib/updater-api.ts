/**
 * Auto-updater API for WaveType
 * Handles checking for updates and installing them from GitHub releases
 */

import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { logger } from "./logger";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
  currentVersion: string;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

export type UpdateStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; info: UpdateInfo }
  | { status: "not-available"; currentVersion: string }
  | { status: "downloading"; progress: UpdateProgress }
  | { status: "ready"; info: UpdateInfo }
  | { status: "error"; message: string };

/**
 * Check for available updates
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    logger.info("Checking for updates...");

    const update = await check();

    if (!update) {
      logger.info("No updates available");
      return {
        status: "not-available",
        currentVersion: await getCurrentVersion(),
      };
    }

    logger.info(`Update available: ${update.version}`);

    return {
      status: "available",
      info: {
        version: update.version,
        date: update.date,
        body: update.body,
        currentVersion: await getCurrentVersion(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to check for updates", { error: message });
    return { status: "error", message };
  }
}

/**
 * Download and install update
 * @param onProgress Callback for download progress updates
 */
export async function downloadAndInstallUpdate(
  onProgress?: (progress: UpdateProgress) => void
): Promise<UpdateStatus> {
  try {
    logger.info("Starting update download...");

    const update = await check();

    if (!update) {
      return {
        status: "not-available",
        currentVersion: await getCurrentVersion(),
      };
    }

    let downloaded = 0;
    let total: number | null = null;

    // Download with progress tracking
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? null;
          logger.info(`Download started, size: ${total ?? "unknown"}`);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress?.({ downloaded, total });
          break;
        case "Finished":
          logger.info("Download finished");
          break;
      }
    });

    logger.info("Update downloaded and ready to install");

    return {
      status: "ready",
      info: {
        version: update.version,
        date: update.date,
        body: update.body,
        currentVersion: await getCurrentVersion(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to download/install update", { error: message });
    return { status: "error", message };
  }
}

/**
 * Relaunch the application after update installation
 */
export async function relaunchApp(): Promise<void> {
  logger.info("Relaunching application...");
  await relaunch();
}

/**
 * Get the current app version
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("get_app_version");
  } catch {
    return "unknown";
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format download progress as percentage
 */
export function formatProgress(progress: UpdateProgress): string {
  if (progress.total === null) {
    return formatBytes(progress.downloaded);
  }
  const percent = Math.round((progress.downloaded / progress.total) * 100);
  return `${percent}% (${formatBytes(progress.downloaded)} / ${formatBytes(
    progress.total
  )})`;
}
