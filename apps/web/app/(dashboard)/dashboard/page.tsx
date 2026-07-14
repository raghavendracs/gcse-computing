"use client";
import { useState } from "react";
import { Code2, History, InboxIcon, Clock, ChevronDown, ChevronRight, ChevronLeft, X, Star } from "lucide-react";
import { useMe } from "~/hooks/api/auth";
import { useTopicTree } from "~/hooks/api/topics";
import { useListAttempts, useGetAttemptDetail } from "~/hooks/api/history";
import { useListSessions } from "~/hooks/api/sessions";
import { PracticeSession } from "~/components/PracticeSession";
import { usePracticeTimer } from "~/contexts/PracticeTimerContext";

type SelectedTopic = {
  id: string;
  name: string;
  slug: string;
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function tableDateParts(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

const PAGE_SIZE = 10;

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return (
    <div className="flex items-center justify-end gap-1 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-30"
        style={{ color: "var(--muted-foreground)" }}
        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      ><ChevronLeft className="w-4 h-4" /></button>
      {pages.map((p) => (
        <button key={p} onClick={() => onPage(p)}
          className="w-7 h-7 flex items-center justify-center rounded text-sm font-medium transition-colors"
          style={{ backgroundColor: p === page ? "#4f46e5" : "transparent", color: p === page ? "#fff" : "var(--muted-foreground)" }}
          onMouseEnter={(e) => { if (p !== page) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
          onMouseLeave={(e) => { if (p !== page) e.currentTarget.style.backgroundColor = "transparent"; }}
        >{p}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-30"
        style={{ color: "var(--muted-foreground)" }}
        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      ><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

type SessionItem = {
  id: string; mode: string; startedAt: string; endedAt?: string;
  durationSeconds?: number;
  summary: { questionsAttempted: number; averageScore: number; hintsUsed: number };
};

type AttemptItem = {
  id: string;
  questionId: string;
  topicId: string;
  attemptNumber: number;
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  pointsAwardedThisAttempt: number;
  feedback: string;
  strengths: string[];
  missingPoints: string[];
  hintsUsedCount: number;
  timeSpentSeconds: number;
  createdAt: string;
};

function SessionsPanel({ sessions, isLoading, page, onPage }: {
  sessions: SessionItem[]; isLoading: boolean; page: number; onPage: (p: number) => void;
}) {
  if (isLoading) return (
    <div className="p-5 space-y-2 animate-pulse">
      {[1,2,3,4,5].map((i) => <div key={i} className="h-14 rounded" style={{ backgroundColor: "var(--accent)" }} />)}
    </div>
  );
  if (sessions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--muted-foreground)" }}>
      <Clock className="w-10 h-10 opacity-20" />
      <p className="text-sm font-medium">No sessions yet</p>
    </div>
  );
  const rows = sessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto">
        <div className="w-[90%] mx-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "22%" }}>Date / Time</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "18%" }}>Mode</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "18%" }}>Duration</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Questions</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Score</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Hints</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const pct = s.summary.questionsAttempted > 0 ? s.summary.averageScore : null;
                const scoreColour = pct === null ? "var(--muted-foreground)" : pct >= 0.7 ? "#16a34a" : pct >= 0.5 ? "#d97706" : "#dc2626";
                const { date, time } = tableDateParts(s.startedAt);
                return (
                  <tr key={s.id} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-4 group-hover:opacity-80 transition-opacity">
                      <p className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{date}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{time}</p>
                    </td>
                    <td className="py-4">
                      <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-md" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>
                        {s.mode}
                      </span>
                    </td>
                    <td className="py-4 text-sm font-mono" style={{ color: "var(--muted-foreground)" }}>
                      {s.durationSeconds !== undefined ? formatDuration(s.durationSeconds) : "—"}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: "var(--foreground)" }}>{s.summary.questionsAttempted || "—"}</td>
                    <td className="py-4 text-right text-sm font-semibold" style={{ color: scoreColour }}>
                      {pct !== null ? `${Math.round(pct * 100)}%` : "—"}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: "var(--muted-foreground)" }}>{s.summary.hintsUsed || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} total={sessions.length} onPage={onPage} />
    </div>
  );
}

function AttemptDetailExpanded({ attemptId }: { attemptId: string }) {
  const { attempt, isLoading } = useGetAttemptDetail(attemptId);

  if (isLoading) {
    return (
      <tr>
        <td colSpan={6} className="px-6 py-4">
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-4 rounded" style={{ backgroundColor: "var(--accent)" }} />)}
          </div>
        </td>
      </tr>
    );
  }

  if (!attempt) return null;

  return (
    <tr>
      <td colSpan={6} style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
        <div className="px-6 py-4 space-y-4">
          {attempt.questionText && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Question</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{attempt.questionText}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Your code</p>
            <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "monospace" }}>
              {attempt.submittedCode}
            </pre>
          </div>

          {attempt.feedback.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#16a34a" }}>Strengths</p>
              <ul className="space-y-0.5">
                {attempt.feedback.strengths.map((s: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "var(--foreground)" }}>
                    <span style={{ color: "#16a34a" }}>✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {attempt.feedback.missingPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#dc2626" }}>Missing points</p>
              <ul className="space-y-0.5">
                {attempt.feedback.missingPoints.map((p: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "var(--foreground)" }}>
                    <span style={{ color: "#dc2626" }}>✗</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {attempt.modelAnswer && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Model answer</p>
              <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "monospace" }}>
                {attempt.modelAnswer}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function AttemptsPanel({ attempts, isLoading, page, onPage, topicNameMap }: {
  attempts: AttemptItem[];
  isLoading: boolean;
  page: number;
  onPage: (p: number) => void;
  topicNameMap: Map<string, string>;
}) {
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  if (isLoading) return (
    <div className="p-5 space-y-2 animate-pulse">
      {[1,2,3,4,5].map((i) => <div key={i} className="h-14 rounded" style={{ backgroundColor: "var(--accent)" }} />)}
    </div>
  );
  if (attempts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--muted-foreground)" }}>
      <InboxIcon className="w-10 h-10 opacity-20" />
      <p className="text-sm font-medium">No questions attempted yet</p>
    </div>
  );
  const rows = attempts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto">
        <div className="w-[90%] mx-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "20%" }}>Date / Time</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "36%" }}>Topic</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "16%" }}>Score</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "12%" }}>Points</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "10%" }}>Hints</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "4%" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const topicName = topicNameMap.get(a.topicId) ?? "Unknown topic";
                const pct = a.totalTests > 0 ? a.testsPassed / a.totalTests : 0;
                const scoreColour = pct >= 0.7 ? "#16a34a" : pct >= 0.5 ? "#d97706" : "#dc2626";
                const scoreBg = pct >= 0.7 ? "#f0fdf4" : pct >= 0.5 ? "#fffbeb" : "#fef2f2";
                const { date, time } = tableDateParts(a.createdAt);
                return (
                  <>
                  <tr key={a.id} className="group cursor-pointer" style={{ borderBottom: expandedAttemptId === a.id ? "none" : "1px solid var(--border)" }} onClick={() => setExpandedAttemptId(prev => prev === a.id ? null : a.id)}>
                    <td className="py-4 group-hover:opacity-80 transition-opacity">
                      <p className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{date}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{time}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{topicName}</p>
                    </td>
                    <td className="py-4 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: scoreBg, color: scoreColour }}>
                        {a.testsPassed}/{a.totalTests}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm font-semibold" style={{ color: "#4f46e5" }}>
                      {a.pointsAwardedThisAttempt > 0 ? `+${a.pointsAwardedThisAttempt}` : "—"}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: "var(--muted-foreground)" }}>{a.hintsUsedCount || "—"}</td>
                    <td className="py-4 pl-2">
                      <ChevronDown
                        className="w-3.5 h-3.5 transition-transform"
                        style={{
                          color: "var(--muted-foreground)",
                          transform: expandedAttemptId === a.id ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </td>
                  </tr>
                  {expandedAttemptId === a.id && <AttemptDetailExpanded key={`detail-${a.id}`} attemptId={a.id} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} total={attempts.length} onPage={onPage} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useMe();
  const { tree, isLoading: treeLoading } = useTopicTree();
  const { timeSpent, timerReady, totalAttempts } = usePracticeTimer();

  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [selectedTopic, setSelectedTopic] = useState<SelectedTopic | null>(null);
  const [practiceKey, setPracticeKey] = useState(0);
  const [rightPanelView, setRightPanelView] = useState<null | "sessions" | "attempts">(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [attemptsPage, setAttemptsPage] = useState(1);

  const { sessions: panelSessions, isLoading: panelSessionsLoading } = useListSessions({
    limit: 100,
    enabled: rightPanelView === "sessions",
  });
  const { attempts: panelAttempts, isLoading: panelAttemptsLoading } = useListAttempts({
    limit: 200,
    enabled: rightPanelView === "attempts",
  });

  // Build topicId → name map from the tree for the attempts panel
  const topicNameMap = new Map<string, string>();
  for (const area of tree) {
    for (const topic of area.topics) {
      topicNameMap.set(topic.id, topic.name);
    }
  }

  const handleSelectTopic = (topic: SelectedTopic) => {
    if (selectedTopic?.id === topic.id) {
      setSelectedTopic(null);
      return;
    }
    setSelectedTopic(topic);
    setPracticeKey((k) => k + 1);
    setRightPanelView(null);
  };

  const firstName = user?.displayName ?? user?.fullName?.split(" ")[0] ?? "there";
  const totalPoints = user?.totalPoints ?? 0;

  return (
    <div className="flex -mx-4 -my-8" style={{ height: "calc(100vh - 3rem)" }}>

      {/* ── Left column: topic tree sidebar ── */}
      <div
        className="w-72 shrink-0 overflow-y-auto no-scrollbar"
        style={{
          borderRight: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          boxShadow: "4px 0 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Hi {firstName} 👋</p>
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" }}>
              <Star className="w-3 h-3" />
              {totalPoints} pts
            </span>
          </div>

          {/* Stats chips */}
          <div className="flex flex-col gap-1">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              style={{
                backgroundColor: rightPanelView === "sessions" ? "#e0e7ff" : "#eef2ff",
                border: `1px solid ${rightPanelView === "sessions" ? "#a5b4fc" : "#c7d2fe"}`,
              }}
              onClick={() => {
                const next = rightPanelView === "sessions" ? null : "sessions" as const;
                setRightPanelView(next);
                if (next) { setSelectedTopic(null); setSessionsPage(1); }
              }}
            >
              <Clock className="w-3 h-3 shrink-0" style={{ color: rightPanelView === "sessions" ? "#3730a3" : "#4f46e5" }} />
              <p className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>Practice time</p>
              <p className="text-xs font-bold font-mono ml-auto" style={{ color: "var(--foreground)" }}>
                {timerReady ? (() => { const h = Math.floor(timeSpent / 3600); const m = Math.floor((timeSpent % 3600) / 60); const s = timeSpent % 60; return `${h}h:${m}m:${s}s`; })() : "0h:0m:0s"}
              </p>
            </div>
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              style={{
                backgroundColor: rightPanelView === "attempts" ? "#dcfce7" : "#f0fdf4",
                border: `1px solid ${rightPanelView === "attempts" ? "#86efac" : "#bbf7d0"}`,
              }}
              onClick={() => {
                const next = rightPanelView === "attempts" ? null : "attempts" as const;
                setRightPanelView(next);
                if (next) { setSelectedTopic(null); setAttemptsPage(1); }
              }}
            >
              <History className="w-3 h-3 shrink-0" style={{ color: rightPanelView === "attempts" ? "#15803d" : "#16a34a" }} />
              <p className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>Questions done</p>
              <p className="text-xs font-bold ml-auto" style={{ color: "var(--foreground)" }}>{totalAttempts}</p>
            </div>
          </div>
        </div>

        {/* Topic tree */}
        {treeLoading ? (
          <div className="p-3 space-y-2 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-10 rounded-lg" style={{ backgroundColor: "var(--accent)" }} />)}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {tree.map(({ area, topics }) => {
              const isOpen = expandedAreas[area] !== false; // default open
              const solved = topics.reduce((sum, t) => sum + t.solvedCount, 0);
              const total = topics.reduce((sum, t) => sum + t.totalQuestions, 0);
              return (
                <div key={area} className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {/* Area header */}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={() => setExpandedAreas((prev) => ({ ...prev, [area]: !isOpen }))}
                  >
                    <Code2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#a855f7" }} />
                    <p className="font-semibold text-sm flex-1 min-w-0 truncate" style={{ color: "var(--foreground)" }}>{area}</p>
                    <span className="text-xs font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                      {solved}/{total}
                    </span>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />}
                  </button>

                  {/* Sub-areas */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      {topics.map((topic) => {
                        const isSelected = selectedTopic?.id === topic.id;
                        const pct = topic.totalQuestions > 0 ? topic.solvedCount / topic.totalQuestions : 0;
                        const chipColour = pct >= 1 ? "#16a34a" : pct > 0 ? "#d97706" : "var(--muted-foreground)";
                        const chipBg = pct >= 1 ? "#f0fdf4" : pct > 0 ? "#fffbeb" : "var(--accent)";
                        return (
                          <button
                            key={topic.id}
                            className="w-full text-left transition-colors flex items-center justify-between gap-2"
                            style={{
                              padding: "6px 12px 6px 16px",
                              backgroundColor: isSelected ? "var(--accent)" : "transparent",
                              borderLeft: isSelected ? "2px solid #6366f1" : "2px solid transparent",
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                            onClick={() => handleSelectTopic({ id: topic.id, name: topic.name, slug: topic.slug })}
                          >
                            <p className="text-xs min-w-0 truncate" style={{ color: "var(--foreground)", fontWeight: isSelected ? "500" : "400" }}>{topic.name}</p>
                            <span className="text-xs font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: chipBg, color: chipColour, border: "1px solid var(--border)" }}>
                              {topic.solvedCount}/{topic.totalQuestions}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right column: content panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
        {rightPanelView !== null ? (
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                    {rightPanelView === "sessions" ? "Practice Sessions" : "Questions Attempted"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {rightPanelView === "sessions" ? "All your study sessions" : "All questions you have answered"}
                  </p>
                </div>
                <button
                  onClick={() => setRightPanelView(null)}
                  className="p-1 rounded-md transition-colors mt-0.5"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.color = "var(--foreground)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                {rightPanelView === "sessions" ? (
                  <SessionsPanel sessions={panelSessions as SessionItem[]} isLoading={panelSessionsLoading} page={sessionsPage} onPage={setSessionsPage} />
                ) : (
                  <AttemptsPanel
                    attempts={panelAttempts as AttemptItem[]}
                    isLoading={panelAttemptsLoading}
                    page={attemptsPage}
                    onPage={setAttemptsPage}
                    topicNameMap={topicNameMap}
                  />
                )}
              </div>
            </div>
          </div>
        ) : !selectedTopic ? (
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--accent)" }}>
                  <Code2 className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
                </div>
                <p className="font-medium" style={{ color: "var(--foreground)" }}>Select a topic</p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Pick any topic from the left panel to start coding practice</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {/* Topic header */}
              <div className="px-5 pt-4 pb-3 shrink-0 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <Code2 className="w-4 h-4 shrink-0" style={{ color: "#a855f7" }} />
                <h2 className="font-semibold text-base flex-1 min-w-0 truncate" style={{ color: "var(--foreground)" }}>{selectedTopic.name}</h2>
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: "#fdf4ff", color: "#a855f7", border: "1px solid #e9d5ff" }}>
                  Coding
                </span>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="p-1 rounded-md transition-colors shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Practice area — scrollable */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
                {/* @ts-expect-error — PracticeSession will accept topicId in Task 25 */}
                <PracticeSession topicId={selectedTopic.id} key={practiceKey} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
