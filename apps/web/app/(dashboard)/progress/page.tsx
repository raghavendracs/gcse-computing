"use client";
import Link from "next/link";
import { useGetProgress } from "~/hooks/api/progress";

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const colour =
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-slate-700 w-10 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export default function ProgressPage() {
  const { progress, isLoading } = useGetProgress();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-200 rounded-xl" />
        <div className="h-48 bg-slate-200 rounded-xl" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No progress yet</p>
        <p className="text-sm mt-1">Complete your first question to see progress here</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800">
          Go to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Progress</h1>
        <p className="text-slate-500 mt-1">Your learning overview</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{progress.streak.currentDays}</p>
          <p className="text-xs text-slate-500 mt-1">day streak</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{progress.totalAttempts}</p>
          <p className="text-xs text-slate-500 mt-1">total attempts</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{progress.moduleProgress.length}</p>
          <p className="text-xs text-slate-500 mt-1">modules studied</p>
        </div>
      </div>

      {/* Weak areas */}
      {progress.weakAreas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Needs attention</h2>
          <div className="space-y-3">
            {progress.weakAreas.map((w) => (
              <div key={w.moduleId} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-medium text-amber-900">{w.moduleName}</p>
                <p className="text-xs text-amber-700 mt-0.5">{w.reasons.join(" · ")}</p>
                <p className="text-sm text-amber-800 mt-2 italic">{w.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">All modules</h2>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {progress.moduleProgress
            .sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt))
            .map((m) => (
              <div key={m.moduleId} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{m.moduleName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {m.totalAttempts} attempt{m.totalAttempts !== 1 ? "s" : ""} · {m.hintsPerQuestion.toFixed(1)} hints/q
                  </p>
                </div>
                <ScoreBar score={m.averageScore} />
                {(m.weakAreaFlags.lowAccuracy || m.weakAreaFlags.hintDependent || m.weakAreaFlags.errorProne) && (
                  <span className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Weak
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
