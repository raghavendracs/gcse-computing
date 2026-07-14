"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Lightbulb, Play, Loader2, ChevronDown, ChevronRight, SkipForward, List, Check } from "lucide-react";
import {
  useGetForTopic,
  useGetQuestionById,
  useListForTopic,
  useRunCode,
  useSubmit,
  useRequestCodingHint,
} from "~/hooks/api/questions";
import { useStartSession, useEndSession } from "~/hooks/api/sessions";
import { QuestionText } from "~/components/QuestionText";
import { usePracticeTimer } from "~/contexts/PracticeTimerContext";

const CodeEditor = dynamic(() => import("~/app/(dashboard)/modules/[id]/coding/CodeEditor"), { ssr: false });

const MAX_HINTS = 5;
const DEFAULT_CODE = "# Write your Python solution here\n";

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   colour: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  medium: { label: "Medium", colour: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  hard:   { label: "Hard",   colour: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
} as const;

type Difficulty = "easy" | "medium" | "hard";
type QuestionStatus = "not_attempted" | "attempted" | "solved";

type TestResult = {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  hidden: boolean;
};

type SubmitResult = {
  attemptId: string;
  testResults: TestResult[];
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  feedback: {
    text: string;
    strengths: string[];
    missingPoints: string[];
    syntaxValid: boolean;
    errorCategory: "syntax" | "logic" | "runtime" | null;
  };
  pointsAwarded: number;
  newTotalPoints: number;
  solved: boolean;
  modelAnswer: string;
};

type QuestionListItem = {
  id: string;
  difficulty: Difficulty;
  questionType: "write" | "fix" | "extend";
  points: number;
  questionText: string;
  status: QuestionStatus;
  bestPointsAwarded: number;
  attemptsCount: number;
};

const TYPE_LABEL: Record<"write" | "fix" | "extend", string> = {
  write: "Write code",
  fix: "Fix the bug",
  extend: "Extend code",
};

// ─── Difficulty selector ─────────────────────────────────────────────────────

function DifficultySelector({ value, onChange }: { value: Difficulty; onChange: (v: Difficulty) => void }) {
  return (
    <div className="flex gap-2">
      {(["easy", "medium", "hard"] as const).map((d) => {
        const cfg = DIFFICULTY_CONFIG[d];
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: active ? cfg.bg : "var(--card)",
              border: `1px solid ${active ? cfg.border : "var(--border)"}`,
              color: active ? cfg.colour : "var(--muted-foreground)",
            }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{ borderColor: active ? cfg.colour : "var(--border)" }}
            >
              {active && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.colour }} />
              )}
            </span>
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Test-results table ──────────────────────────────────────────────────────

function TestResultsTable({ results, label }: { results: TestResult[]; label: string }) {
  const passed = results.filter((r) => r.passed).length;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide px-1 mb-2" style={{ color: "var(--muted-foreground)" }}>
        {label} — {passed}/{results.length} passed
      </p>
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--accent)" }}>
              <th className="px-3 py-2 text-left font-semibold w-8" style={{ color: "var(--muted-foreground)" }}>#</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted-foreground)" }}>Input</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted-foreground)" }}>Expected</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--muted-foreground)" }}>Got</th>
              <th className="px-3 py-2 text-center font-semibold w-20" style={{ color: "var(--muted-foreground)" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: i < results.length - 1 ? "1px solid var(--border)" : undefined,
                  backgroundColor: r.passed ? "#f0fdf420" : "#fef2f220",
                }}
              >
                <td className="px-3 py-2" style={{ color: "var(--muted-foreground)" }}>{i + 1}</td>
                <td className="px-3 py-2 max-w-30 truncate" style={{ color: "var(--foreground)" }}>
                  {r.hidden ? <span style={{ color: "var(--muted-foreground)" }}>—</span> : (r.input || "(none)")}
                </td>
                <td className="px-3 py-2 max-w-30 truncate" style={{ color: "#16a34a" }}>
                  {r.hidden ? <span style={{ color: "var(--muted-foreground)" }}>—</span> : r.expectedOutput}
                </td>
                <td className="px-3 py-2 max-w-30 truncate" style={{ color: r.passed ? "#16a34a" : "#dc2626" }}>
                  {r.hidden ? <span style={{ color: "var(--muted-foreground)" }}>—</span> : (r.actualOutput || "(no output)")}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: r.passed ? "#dcfce7" : "#fecdd3",
                      color: r.passed ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {r.passed ? "Pass" : "Fail"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Status badge for the questions list ─────────────────────────────────────

const STATUS_CONFIG: Record<QuestionStatus, { label: string; colour: string; bg: string }> = {
  solved:        { label: "Solved",        colour: "#16a34a", bg: "#dcfce7" },
  attempted:     { label: "Attempted",     colour: "#d97706", bg: "#fef3c7" },
  not_attempted: { label: "Not attempted", colour: "var(--muted-foreground)", bg: "var(--accent)" },
};

// ─── All-questions list ──────────────────────────────────────────────────────

function QuestionTag({ label, colour, bg, border }: { label: string; colour: string; bg: string; border?: string }) {
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color: colour, border: border ? `1px solid ${border}` : undefined }}
    >
      {label}
    </span>
  );
}

function QuestionsList({ topicId, onOpen }: { topicId: string; onOpen: (id: string) => void }) {
  const { questions, isLoading } = useListForTopic(topicId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: "var(--accent)" }} />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" style={{ color: "var(--muted-foreground)" }}>
        <List className="w-8 h-8 opacity-30" />
        <p className="text-sm font-medium">No questions here yet</p>
        <p className="text-xs">This section hasn&apos;t been seeded with questions.</p>
      </div>
    );
  }

  const solvedCount = questions.filter((q) => q.status === "solved").length;

  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {questions.length} question{questions.length === 1 ? "" : "s"}
        </p>
        <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
          {solvedCount}/{questions.length} solved
        </p>
      </div>

      <ul className="space-y-2">
        {(questions as QuestionListItem[]).map((q, i) => {
          const expanded = expandedId === q.id;
          const diff = DIFFICULTY_CONFIG[q.difficulty];
          const status = STATUS_CONFIG[q.status];
          const firstLine = q.questionText.split("\n")[0];
          return (
            <li key={q.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              {/* Header — click to expand/collapse */}
              <button
                onClick={() => setExpandedId(expanded ? null : q.id)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={
                    q.status === "solved"
                      ? { backgroundColor: "#16a34a", color: "#fff" }
                      : q.status === "attempted"
                        ? { backgroundColor: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }
                        : { backgroundColor: "var(--accent)", color: "var(--muted-foreground)" }
                  }
                  title={status.label}
                >
                  {q.status === "solved" ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>

                <span
                  className={`flex-1 min-w-0 text-sm ${expanded ? "" : "truncate"}`}
                  style={{ color: "var(--foreground)" }}
                >
                  {firstLine}
                </span>

                {expanded
                  ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />}
              </button>

              {/* Expanded body — full question, then tags grouped below it */}
              {expanded && (
                <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="pt-3">
                    <QuestionText text={q.questionText} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <QuestionTag label={TYPE_LABEL[q.questionType]} colour="var(--muted-foreground)" bg="var(--accent)" />
                    <QuestionTag label={diff.label} colour={diff.colour} bg={diff.bg} border={diff.border} />
                    <QuestionTag label={`${q.points} pts`} colour="var(--muted-foreground)" bg="var(--accent)" />
                    <QuestionTag label={status.label} colour={status.colour} bg={status.bg} />
                    {q.status !== "not_attempted" && (
                      <span className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                        best {q.bestPointsAwarded}/{q.points}
                      </span>
                    )}
                    <button
                      onClick={() => onOpen(q.id)}
                      className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      {q.status === "solved" ? "Review →" : "Solve →"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── PracticeSession ─────────────────────────────────────────────────────────

interface Props {
  topicId: string;
}

export function PracticeSession({ topicId }: Props) {
  const { startTimer, stopTimer, timeSpent, registerEndSession, unregisterEndSession } = usePracticeTimer();

  const [view, setView] = useState<"practice" | "list">("practice");
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>("medium");

  // When set, the practice view shows this specific question (opened from the list);
  // otherwise it pulls a random unsolved question via getForTopic.
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  // Question to skip past (never re-served by getForTopic).
  const [excludeId, setExcludeId] = useState<string | undefined>(undefined);

  const [code, setCode] = useState(DEFAULT_CODE);
  const [runResults, setRunResults] = useState<TestResult[] | null>(null);
  const [runError, setRunError] = useState("");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const [hints, setHints] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(true);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [error, setError] = useState("");

  const sessionIdRef = useRef<string | null>(null);
  const questionStartedAt = useRef<number>(Date.now());

  // Question source — one of these is active at a time
  const random = useGetForTopic({
    topicId,
    difficulty: activeDifficulty,
    excludeQuestionId: excludeId,
    enabled: started && !selectedQuestionId,
  });
  const byId = useGetQuestionById(selectedQuestionId ?? "");

  const question = (selectedQuestionId ? byId.question : random.question) ?? null;
  const isLoading = selectedQuestionId ? byId.isLoading : random.isLoading;
  const isFetching = selectedQuestionId ? byId.isFetching : random.isFetching;
  const refetch = selectedQuestionId ? byId.refetch : random.refetch;

  const runCode = useRunCode();
  const submit = useSubmit();
  const requestCodingHint = useRequestCodingHint();
  const startSession = useStartSession();
  const endSession = useEndSession();

  // Reset editor + results when the question changes
  useEffect(() => {
    if (!question) return;
    setCode(question.starterCode ?? DEFAULT_CODE);
    setRunResults(null);
    setRunError("");
    setSubmitResult(null);
    setHints([]);
    setShowHints(true);
    setShowModelAnswer(false);
    setError("");
    questionStartedAt.current = Date.now();
    startTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregisterEndSession();
      stopTimer();
      if (sessionIdRef.current) {
        endSession.mutate({ sessionId: sessionIdRef.current });
        sessionIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause/resume on tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else if (started && !submitResult) {
        startTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, submitResult]);

  const handleEnd = useCallback(() => {
    unregisterEndSession();
    if (sessionIdRef.current) {
      endSession.mutate({ sessionId: sessionIdRef.current });
      sessionIdRef.current = null;
    }
    stopTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return;
    registerEndSession(handleEnd);
    try {
      const { sessionId } = await startSession.mutateAsync({ mode: "coding" });
      sessionIdRef.current = sessionId;
    } catch {
      // Non-critical — session tracking is optional
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleEnd]);

  const handleStart = async () => {
    setActiveDifficulty(difficulty);
    setSelectedQuestionId(null);
    setExcludeId(undefined);
    setStarted(true);
    await ensureSession();
  };

  // Load a fresh random question (after a solve — the solved one is auto-excluded server-side)
  const handleNextQuestion = () => {
    setSelectedQuestionId(null);
    setExcludeId(undefined);
    setActiveDifficulty(difficulty);
    setStarted(true);
    setView("practice");
    setCode(DEFAULT_CODE);
    setRunResults(null);
    setRunError("");
    setSubmitResult(null);
    setHints([]);
    setShowHints(true);
    setShowModelAnswer(false);
    setError("");
    refetch();
  };

  // Skip past the current question — load a different unsolved one (nothing saved)
  const handleSkip = () => {
    const current = question?.id;
    setSelectedQuestionId(null); // back to random mode
    if (current) setExcludeId(current);
    setActiveDifficulty(difficulty);
  };

  // Open a specific question from the "All questions" list (incl. already-solved, for review)
  const handleOpenFromList = async (id: string) => {
    setSelectedQuestionId(id);
    setExcludeId(undefined);
    setStarted(true);
    setView("practice");
    await ensureSession();
  };

  const handleRun = async () => {
    if (!question || !code.trim()) return;
    setRunError("");
    try {
      const result = await runCode.mutateAsync({ questionId: question.id, code });
      if (result.blocked) {
        setRunError(`Restricted: \`${result.blockReason}\` is not allowed in GCSE practice.`);
        setRunResults(null);
      } else if (result.timedOut) {
        setRunError("Code took too long — check for infinite loops.");
        setRunResults(null);
      } else {
        setRunResults(result.testResults as TestResult[]);
        if (result.stderr) {
          setRunError(result.stderr.split("\n").slice(-2).join(" "));
        }
      }
    } catch {
      setError("Run failed. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!question || !code.trim()) return;
    stopTimer();
    try {
      const result = await submit.mutateAsync({
        questionId: question.id,
        code,
        hintsUsed: hints.length,
        timeSpentSeconds: Math.round(timeSpent),
        sessionId: sessionIdRef.current ?? undefined,
      });
      setSubmitResult(result as SubmitResult);
    } catch {
      setError("Submission failed. Please try again.");
      startTimer();
    }
  };

  const handleHint = async () => {
    if (!question || hints.length >= MAX_HINTS || requestCodingHint.isPending) return;
    try {
      const { hintText } = await requestCodingHint.mutateAsync({
        questionId: question.id,
        code,
        currentHintLevel: hints.length,
        testResults: runResults ?? undefined,
      });
      setHints((prev) => [...prev, hintText]);
      setShowHints(true);
    } catch {
      setError("Could not load hint.");
    }
  };

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const TabBar = (
    <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "var(--accent)" }}>
      {([
        { key: "practice", label: "Practice", icon: Play },
        { key: "list", label: "All questions", icon: List },
      ] as const).map((t) => {
        const active = view === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors"
            style={{
              backgroundColor: active ? "var(--card)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
              border: active ? "1px solid var(--border)" : "1px solid transparent",
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  // ── All-questions tab ────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div>
        {TabBar}
        <QuestionsList topicId={topicId} onOpen={handleOpenFromList} />
      </div>
    );
  }

  // ── Practice tab: start screen ───────────────────────────────────────────────
  if (!started) {
    return (
      <div>
        {TabBar}
        <div className="flex flex-col justify-center py-8 px-2 max-w-xs mx-auto gap-6">
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1" style={{ backgroundColor: "#d1fae5" }}>
              <Play className="w-4 h-4" style={{ color: "#059669" }} />
            </div>
            <p className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Coding practice</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Write Python code to solve problems and earn points</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Difficulty</p>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
          </div>

          <button
            onClick={handleStart}
            disabled={startSession.isPending}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#059669", color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Play className="w-4 h-4" />
            Start Practice
          </button>
        </div>
      </div>
    );
  }

  // ── Practice tab: loading ────────────────────────────────────────────────────
  if (isLoading || isFetching) {
    return (
      <div>
        {TabBar}
        <div className="space-y-4 animate-pulse py-4">
          <div className="h-4 rounded w-1/4" style={{ backgroundColor: "var(--accent)" }} />
          <div className="h-24 rounded" style={{ backgroundColor: "var(--accent)" }} />
          <div className="h-32 rounded" style={{ backgroundColor: "var(--accent)" }} />
        </div>
      </div>
    );
  }

  // ── Practice tab: no question available ──────────────────────────────────────
  if (!question) {
    return (
      <div>
        {TabBar}
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#f0fdf4" }}>
            <span className="text-2xl">🎉</span>
          </div>
          <div>
            <p className="font-semibold text-base" style={{ color: "var(--foreground)" }}>All done!</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
              No more unsolved {activeDifficulty} questions here. Try a different difficulty, or browse all questions.
            </p>
          </div>
          <div className="space-y-2 w-full max-w-xs">
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
            <button
              onClick={handleNextQuestion}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Try {difficulty} questions
            </button>
            <button
              onClick={() => setView("list")}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Browse all questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Practice tab: the question ───────────────────────────────────────────────
  const diffCfg = DIFFICULTY_CONFIG[question.difficulty];

  return (
    <div>
      {TabBar}
      <div key={question.id}>
        {/* Question card */}
        <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              {question.questionType === "write" ? "Write code" : question.questionType === "fix" ? "Fix the bug" : "Extend code"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Python</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: diffCfg.bg, color: diffCfg.colour, border: `1px solid ${diffCfg.border}` }}
              >
                {diffCfg.label}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--accent)", color: "var(--muted-foreground)" }}>
                {question.points} {question.points === 1 ? "pt" : "pts"}
              </span>
            </div>
          </div>
          <QuestionText text={question.questionText} />
        </div>

        {/* Hints panel */}
        {hints.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <button onClick={() => setShowHints((v) => !v)} className="flex items-center justify-between w-full text-left px-1">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Hints ({hints.length})
              </span>
              <span className="text-xs text-amber-500">{showHints ? "▲" : "▼"}</span>
            </button>
            {showHints && hints.map((hint, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <span className="text-xs font-semibold text-amber-700 mr-2">Hint {i + 1}</span>
                <span className="text-sm text-amber-800">{hint}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Pre-submit: editor + run/hint/skip/submit ────────────────────────── */}
        {!submitResult ? (
          <>
            <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <CodeEditor value={code} onChange={(val) => { setCode(val); }} />
            </div>

            {runError && (
              <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-rose-700 mb-1">Error</p>
                <p className="text-sm text-rose-800 font-mono whitespace-pre-wrap">{runError}</p>
              </div>
            )}

            {runResults && (
              <TestResultsTable results={runResults} label="Run Results" />
            )}

            {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRun}
                disabled={runCode.isPending || !code.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                {runCode.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                {runCode.isPending ? "Running…" : "Run ▶"}
              </button>

              <button
                onClick={handleHint}
                disabled={requestCodingHint.isPending || hints.length >= MAX_HINTS}
                className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requestCodingHint.isPending
                  ? "Loading…"
                  : hints.length === 0
                  ? "Get hint"
                  : hints.length < MAX_HINTS
                  ? `Hint ${hints.length + 1}/${MAX_HINTS}`
                  : "No more hints"}
              </button>

              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                title="Skip to a different question (nothing is saved)"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>

              <button
                onClick={handleSubmit}
                disabled={submit.isPending || !code.trim()}
                className="flex-1 min-w-24 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submit.isPending ? "Submitting…" : "Submit →"}
              </button>
            </div>
          </>
        ) : (
          /* ── Post-submit: results + feedback + model answer ──────────────────── */
          <div className="space-y-3">
            {/* Points badge */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 flex-wrap">
                {submitResult.pointsAwarded > 0 ? (
                  <span
                    className="text-lg font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" }}
                  >
                    +{submitResult.pointsAwarded} pts
                  </span>
                ) : (
                  <span
                    className="text-sm font-medium px-3 py-1 rounded-full"
                    style={{ backgroundColor: "var(--accent)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                  >
                    {submitResult.solved ? "Already solved — no new points" : "0 pts"}
                  </span>
                )}
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Total: {submitResult.newTotalPoints} pts
                </span>
                {hints.length > 0 && (
                  <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {hints.length} hint{hints.length > 1 ? "s" : ""} used
                  </span>
                )}
              </div>
            </div>

            {/* Full test results table */}
            <TestResultsTable results={submitResult.testResults} label="Test Results" />

            {/* AI feedback */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Feedback</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{submitResult.feedback.text}</p>
            </div>

            {submitResult.feedback.strengths.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">What you got right</p>
                <ul className="space-y-1">
                  {submitResult.feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-emerald-800 flex gap-2"><span>✓</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {submitResult.feedback.missingPoints.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">Missing points</p>
                <ul className="space-y-1">
                  {submitResult.feedback.missingPoints.map((p, i) => (
                    <li key={i} className="text-sm text-rose-800 flex gap-2"><span>✗</span><span>{p}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {/* Model answer (collapsible) */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <button
                onClick={() => setShowModelAnswer((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                {showModelAnswer
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
                {showModelAnswer ? "Hide model answer" : "Show model answer"}
              </button>
              {showModelAnswer && (
                <pre className="mt-3 text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {submitResult.modelAnswer}
                </pre>
              )}
            </div>

            {/* Next question */}
            <div className="pt-2 flex items-center gap-3">
              <DifficultySelector value={difficulty} onChange={setDifficulty} />
              <button
                onClick={handleNextQuestion}
                className="shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Next question →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
