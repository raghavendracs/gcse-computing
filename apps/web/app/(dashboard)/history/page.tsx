"use client";
import Link from "next/link";
import { useListAttempts } from "~/hooks/api/history";
import { useListModules } from "~/hooks/api/modules";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HistoryPage() {
  const { attempts, isLoading } = useListAttempts({ limit: 20 });
  const { modules } = useListModules();

  const moduleMap = Object.fromEntries(modules.map((m) => [m.id, m]));

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">History</h1>
        <p className="text-slate-500 mt-1">Your past question attempts</p>
      </div>

      {attempts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No attempts yet</p>
          <p className="text-sm mt-1">Start practising to see your history here</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800"
          >
            Go to dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const mod = moduleMap[attempt.moduleId];
            const pct = attempt.maxMarks > 0 ? attempt.awardedMarks / attempt.maxMarks : 0;
            const scoreColour =
              pct === 1
                ? "text-emerald-600 bg-emerald-50"
                : pct >= 0.5
                  ? "text-amber-600 bg-amber-50"
                  : "text-rose-600 bg-rose-50";

            return (
              <div
                key={attempt.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
              >
                {/* Score badge */}
                <div
                  className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-sm ${scoreColour}`}
                >
                  <span className="text-lg leading-none">{attempt.awardedMarks}</span>
                  <span className="text-xs opacity-70">/{attempt.maxMarks}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">
                    {mod?.moduleName ?? "Module"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {mod?.topicName ?? ""}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400">{formatDate(attempt.createdAt)}</span>
                    {attempt.hintsUsedCount > 0 && (
                      <span className="text-xs text-amber-500">
                        {attempt.hintsUsedCount} hint{attempt.hintsUsedCount > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatTime(attempt.timeSpentSeconds)}</span>
                  </div>
                </div>

                {/* Attempt number */}
                {attempt.attemptNumber > 1 && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    Attempt #{attempt.attemptNumber}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
