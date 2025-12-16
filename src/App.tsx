import { MainView } from "@/components/main-view";
import { SetupWizard } from "@/components/setup";
import { ToastContainer } from "@/components/ui/toast-container";
import { ToastProvider } from "@/hooks/use-toast";
import { useAppStore, useIsInitialized } from "@/store";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import "./App.css";

function AppContent() {
  const { setupComplete, initializeFromDb } = useAppStore();
  const isInitialized = useIsInitialized();

  // Initialize from database on mount
  useEffect(() => {
    initializeFromDb();
  }, [initializeFromDb]);

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

  return (
    <div className="h-full w-full max-w-md mx-auto">
      {setupComplete ? <MainView /> : <SetupWizard />}
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
