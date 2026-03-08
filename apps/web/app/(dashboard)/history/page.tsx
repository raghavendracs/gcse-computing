"use client";
import { useState } from "react";
import Link from "next/link";
import { useListAttempts, useGetAttemptDetail } from "~/hooks/api/history";
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

function ScoreBadge({ awarded, max }: { awarded: number; max: number }) {
  const pct = max > 0 ? awarded / max : 0;
  const colour =
    pct === 1
      ? "text-emerald-600 bg-emerald-50"
      : pct >= 0.5
        ? "text-amber-600 bg-amber-50"
        : "text-rose-600 bg-rose-50";
  return (
    <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-sm ${colour}`}>
      <span className="text-lg leading-none">{awarded}</span>
      <span className="text-xs opacity-70">/{max}</span>
    </div>
  );
}

function DetailPanel({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { attempt, isLoading } = useGetAttemptDetail(attemptId);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Attempt detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
          </div>
        ) : !attempt ? (
          <p className="text-slate-400">Not found</p>
        ) : (
          <>
            {/* Score */}
            <div className="flex items-center gap-4">
              <ScoreBadge awarded={attempt.assessment.awardedMarks} max={attempt.assessment.maxMarks} />
              <div>
                <p className="font-semibold text-slate-800">
                  {attempt.assessment.awardedMarks} / {attempt.assessment.maxMarks} marks
                </p>
                <p className="text-xs text-slate-400">{formatDate(attempt.createdAt)} · {formatTime(attempt.timeSpentSeconds)} · {attempt.hintsUsedCount} hint{attempt.hintsUsedCount !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Question */}
            {attempt.questionText && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Question</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{attempt.questionText}</p>
              </div>
            )}

            {/* Your answer */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Your answer</p>
              {attempt.submissionType === "code" ? (
                <pre className="text-xs bg-slate-900 text-emerald-300 rounded-xl p-4 overflow-x-auto leading-relaxed">{attempt.submittedAnswer}</pre>
              ) : (
                <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 rounded-xl p-3">{attempt.submittedAnswer}</p>
              )}
            </div>

            {/* AI feedback */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Feedback</p>
              <p className="text-sm text-slate-700 leading-relaxed">{attempt.assessment.feedback}</p>
              {attempt.assessment.strengths.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attempt.assessment.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-emerald-700 flex gap-1.5"><span>✓</span>{s}</li>
                  ))}
                </ul>
              )}
              {attempt.assessment.missingPoints.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attempt.assessment.missingPoints.map((p, i) => (
                    <li key={i} className="text-xs text-rose-700 flex gap-1.5"><span>✗</span>{p}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Model answer */}
            {attempt.modelAnswer && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Model answer</p>
                {attempt.submissionType === "code" ? (
                  <pre className="text-xs bg-slate-900 text-indigo-300 rounded-xl p-4 overflow-x-auto leading-relaxed">{attempt.modelAnswer}</pre>
                ) : (
                  <p className="text-sm text-slate-800 leading-relaxed bg-indigo-50 rounded-xl p-3">{attempt.modelAnswer}</p>
                )}
              </div>
            )}

            {/* Mark scheme */}
            {attempt.markSchemePoints && attempt.markSchemePoints.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Mark scheme</p>
                <ul className="space-y-1">
                  {attempt.markSchemePoints.map((pt, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-slate-400">•</span>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { attempts, isLoading } = useListAttempts({ limit: 20 });
  const { modules } = useListModules();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const moduleMap = Object.fromEntries(modules.map((m) => [m.id, m]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">History</h1>
        <p className="text-slate-500 mt-1">Your past question attempts</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl" />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No attempts yet</p>
          <p className="text-sm mt-1">Start practising to see your history here</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800">
            Go to dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const mod = moduleMap[attempt.moduleId];
            return (
              <button
                key={attempt.id}
                onClick={() => setSelectedId(attempt.id)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <ScoreBadge awarded={attempt.awardedMarks} max={attempt.maxMarks} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{mod?.moduleName ?? "Module"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mod?.topicName ?? ""}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400">{formatDate(attempt.createdAt)}</span>
                    {attempt.hintsUsedCount > 0 && (
                      <span className="text-xs text-amber-500">{attempt.hintsUsedCount} hint{attempt.hintsUsedCount > 1 ? "s" : ""}</span>
                    )}
                    <span className="text-xs text-slate-400">{formatTime(attempt.timeSpentSeconds)}</span>
                  </div>
                </div>
                {attempt.attemptNumber > 1 && (
                  <span className="text-xs text-slate-400 shrink-0">Attempt #{attempt.attemptNumber}</span>
                )}
                <span className="text-slate-300 shrink-0">›</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedId && (
        <DetailPanel attemptId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
