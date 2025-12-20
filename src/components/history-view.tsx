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
import {
  clearTranscriptionHistory,
  deleteTranscriptionItem,
  getTranscriptionHistory,
  getTranscriptionHistoryCount,
  type TranscriptionHistoryItem,
} from "@/lib/voice-api";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  History,
  Loader2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface HistoryViewProps {
  onClose: () => void;
}

const PAGE_SIZE = 20;

export function HistoryView({ onClose }: HistoryViewProps) {
  const [history, setHistory] = useState<TranscriptionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadHistory = async (reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
      setHistory([]);
    }
    try {
      console.log("Loading transcription history...");
      const [items, count] = await Promise.all([
        getTranscriptionHistory(PAGE_SIZE, 0),
        getTranscriptionHistoryCount(),
      ]);
      console.log("Loaded history items:", items, "Total count:", count);
      setHistory(items);
      setTotalCount(count);
      setHasMore(items.length < count);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const offset = history.length;
      console.log("Loading more history from offset:", offset);
      const items = await getTranscriptionHistory(PAGE_SIZE, offset);
      console.log("Loaded more items:", items.length);

      if (items.length === 0) {
        setHasMore(false);
      } else {
        setHistory((prev) => [...prev, ...items]);
        setHasMore(history.length + items.length < totalCount);
      }
    } catch (error) {
      console.error("Failed to load more history:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [history.length, totalCount, isLoadingMore, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoading
        ) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMore, hasMore, isLoadingMore, isLoading]);

  useEffect(() => {
    loadHistory(true);
  }, []);

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTranscriptionItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setTotalCount((prev) => prev - 1);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearTranscriptionHistory();
      setHistory([]);
      setTotalCount(0);
      setHasMore(false);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s`;
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background mesh gradient */}
      <div className="glass-mesh-bg" />

      {/* Glass Header */}
      <div className="border-b border-white/20 dark:border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="glass-button px-1 py-1 rounded-xl text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4 text-foreground/70" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">History</h1>
          </div>
        </div>
        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card border-0">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your transcription history.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="glass-button">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600"
                >
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
            <p className="text-sm text-foreground/60">Loading history...</p>
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="glass-card p-8 rounded-2xl flex flex-col items-center text-center">
            <div className="p-4 rounded-2xl bg-white/30 dark:bg-white/10 mb-4">
              <History className="h-10 w-10 text-foreground/60" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              No transcriptions yet
            </h3>
            <p className="text-sm text-foreground/60">
              Your transcription history will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            {history.map((item) => (
              <div key={item.id} className="glass-card p-4 rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-foreground flex-1 break-words leading-relaxed">
                    {item.text}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="glass-icon-button p-2 rounded-lg transition-all hover:scale-105"
                      onClick={() => handleCopy(item.text, item.id)}
                    >
                      {copiedId === item.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-foreground/60" />
                      )}
                    </button>
                    <button
                      className="glass-icon-button p-2 rounded-lg transition-all hover:scale-105 hover:bg-red-500/10"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-foreground/60">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/30 dark:bg-white/10">
                    <Clock className="h-3 w-3" />
                    {formatDate(item.created_at)}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/30 dark:bg-white/10 capitalize">
                    {item.model_id}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/30 dark:bg-white/10 uppercase">
                    {item.language}
                  </span>
                  {item.duration_ms > 0 && (
                    <span className="px-2 py-1 rounded-lg bg-white/30 dark:bg-white/10">
                      {formatDuration(item.duration_ms)}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Load more trigger / indicator */}
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-foreground/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
              {!hasMore && history.length > 0 && (
                <p className="text-sm text-foreground/50">
                  Showing all {totalCount} transcriptions
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
