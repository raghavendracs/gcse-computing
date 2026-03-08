"use client";
import { X, Lightbulb, InboxIcon } from "lucide-react";
import { useListAttempts } from "~/hooks/api/history";

interface Props {
  topicTitle: string;
  moduleIds: string[];
  studentId?: string;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ScorePill({ awarded, max }: { awarded: number; max: number }) {
  const pct = max > 0 ? awarded / max : 0;
  const colour = pct >= 0.7 ? "bg-emerald-100 text-emerald-700" : pct >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colour}`}>
      {awarded}/{max} marks
    </span>
  );
}

export function TopicHistorySidebar({ topicTitle, moduleIds, studentId, onClose }: Props) {
  const { attempts, isLoading } = useListAttempts({ moduleIds: moduleIds.length > 0 ? moduleIds : undefined, studentId, limit: 50, enabled: true });

  const totalDone = attempts.length;
  const lastAttempted = attempts.length > 0 ? attempts[0].createdAt : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Sidebar */}
      <div
        className="fixed right-0 top-0 h-full w-120 shadow-xl z-50 flex flex-col"
        style={{ backgroundColor: "var(--card)", borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">History</p>
            <p className="font-semibold text-base leading-snug mt-1" style={{ color: "var(--foreground)" }}>{topicTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metrics */}
        {!isLoading && (
          <div className="px-6 py-5 flex items-center gap-8" style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            <div>
              <p className="text-2xl font-bold text-indigo-500 leading-none">{totalDone}</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>questions done</p>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: "var(--border)" }} />
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Last attempted</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--foreground)" }}>
                {lastAttempted ? formatDate(lastAttempted) : "Never"}
              </p>
            </div>
          </div>
        )}

        {/* Attempts list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-6 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl" style={{ backgroundColor: "var(--accent)" }} />
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 px-6" style={{ color: "var(--muted-foreground)" }}>
              <InboxIcon className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">No attempts yet</p>
              <p className="text-xs">Start practising this topic!</p>
            </div>
          ) : (
            <div className="px-2 py-2">
              {attempts.map((a, i) => (
                <div
                  key={a.id}
                  className="px-4 py-4 rounded-lg transition-colors cursor-default mb-1"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Question {attempts.length - i}</span>
                    <ScorePill awarded={a.awardedMarks} max={a.maxMarks} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <Lightbulb className="w-3 h-3 text-amber-400" />
                      {a.hintsUsedCount > 0
                        ? `${a.hintsUsedCount} hint${a.hintsUsedCount === 1 ? "" : "s"} used`
                        : "No hints used"}
                    </span>
                    <span className="text-xs opacity-50" style={{ color: "var(--muted-foreground)" }}>{formatDate(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
