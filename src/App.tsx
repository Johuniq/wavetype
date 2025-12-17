import { MainView } from "@/components/main-view";
import { SetupWizard } from "@/components/setup";
import { TrialExpiredView } from "@/components/trial-expired-view";
import { ToastContainer } from "@/components/ui/toast-container";
import { ToastProvider } from "@/hooks/use-toast";
import { canUseApp } from "@/lib/license-api";
import { useAppStore, useIsInitialized } from "@/store";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import "./App.css";

type AppAccessState = {
  canUse: boolean;
  reason: "licensed" | "trial" | "trial_expired" | "no_license";
  daysRemaining?: number;
};

function AppContent() {
  const { setupComplete, initializeFromDb } = useAppStore();
  const isInitialized = useIsInitialized();
  const [accessState, setAccessState] = useState<AppAccessState | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Initialize from database on mount
  useEffect(() => {
    initializeFromDb();
  }, [initializeFromDb]);

  // Check license/trial status after setup is complete
  useEffect(() => {
    const checkAccess = async () => {
      if (!isInitialized || !setupComplete) {
        setCheckingAccess(false);
        return;
      }

      try {
        const status = await canUseApp();
        setAccessState(status);
      } catch (err) {
        console.error("Failed to check app access:", err);
        // Default to allowing usage if check fails (offline scenario)
        setAccessState({ canUse: true, reason: "trial", daysRemaining: 7 });
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [isInitialized, setupComplete]);

  const handleLicenseActivated = async () => {
    try {
      const status = await canUseApp();
      setAccessState(status);
    } catch {
      // Refresh access state
      setAccessState({ canUse: true, reason: "licensed" });
    }
  };

  // Show loading while initializing from DB
  if (!isInitialized) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if not complete
  if (!setupComplete) {
    return (
      <div className="h-full w-full max-w-md mx-auto">
        <SetupWizard />
      </div>
    );
  }

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking license...</p>
        </div>
      </div>
    );
  }

  // Show trial expired view if trial has expired
  if (
    accessState &&
    !accessState.canUse &&
    accessState.reason === "trial_expired"
  ) {
    return (
      <div className="h-full w-full max-w-md mx-auto">
        <TrialExpiredView onLicenseActivated={handleLicenseActivated} />
      </div>
    );
  }

  return (
    <div className="h-full w-full max-w-md mx-auto">
      <MainView trialDaysRemaining={accessState?.daysRemaining} />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <main className="h-screen w-screen bg-background text-foreground overflow-hidden">
        <AppContent />
        <ToastContainer />
      </main>
    </ToastProvider>
  );
}

export default App;
