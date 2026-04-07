"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Lightbulb, Play, Loader2 } from "lucide-react";
import { useGenerateQuestion, useGenerateQuestionSupport, useSubmitAnswer, useRequestHint, useRunCode, useRequestCodingHint } from "~/hooks/api/questions";
import { useStartSession, useEndSession } from "~/hooks/api/sessions";
import { QuestionText } from "~/components/QuestionText";
import { usePracticeTimer } from "~/contexts/PracticeTimerContext";

const CodeEditor = dynamic(() => import("~/app/(dashboard)/modules/[id]/coding/CodeEditor"), { ssr: false });

const MAX_HINTS = 3;

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   colour: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  medium: { label: "Medium", colour: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  hard:   { label: "Hard",   colour: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
} as const;

function DifficultySelector({ value, onChange }: { value: "easy" | "medium" | "hard"; onChange: (v: "easy" | "medium" | "hard") => void }) {
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

type TestCase = { input: string; expectedOutput: string; hidden: boolean };
type Question = {
  id: string;
  questionText: string;
  maxMarks: number;
  supportReady?: boolean;
  modelAnswer: string;
  hints: string[];
  testCases?: TestCase[];
  metadata: { topicName: string; examBoard: string };
};
type TestResult = {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  hidden: boolean;
};
type Assessment = {
  awardedMarks: number;
  maxMarks: number;
  feedback: string;
  missingPoints: string[];
  strengths: string[];
};

interface Props {
  moduleId: string;
  mode: "theory" | "coding";
  topicTitle?: string;
  topicDescription?: string;
  onEnd?: () => void;
}

export function PracticeSession({ moduleId, mode, onEnd }: Props) {
  const { startTimer, stopTimer, registerEndSession, unregisterEndSession } = usePracticeTimer();
  const questionStartedAt = useRef<number>(0);

  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [question, setQuestion] = useState<Question | null>(null);
  const [isCodingQuestion, setIsCodingQuestion] = useState(false);

  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("# Write your Python solution here\n");
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [runError, setRunError] = useState("");

  const [hintsRevealed, setHintsRevealed] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modelAnswer, setModelAnswer] = useState("");
  const [markSchemePoints, setMarkSchemePoints] = useState<string[]>([]);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [error, setError] = useState("");

  const generateQuestion = useGenerateQuestion();
  const submitAnswer = useSubmitAnswer();
  const requestHint = useRequestHint();
  const runCode = useRunCode();
  const requestCodingHint = useRequestCodingHint();
  const generateQuestionSupport = useGenerateQuestionSupport();
  const [supportReady, setSupportReady] = useState(false);
  const [supportData, setSupportData] = useState<{
    hints: string[];
    modelAnswer: string;
    markSchemePoints: string[];
    testCases: TestCase[];
  } | null>(null);
  const startSession = useStartSession();
  const endSession = useEndSession();
  const sessionIdRef = useRef<string | null>(null);

  // Stop timer when unmounted (topic change) — accumulates across topics
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

  // Pause timer when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else if (started && !assessment) {
        startTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, assessment]);

  useEffect(() => {
    if (supportData && supportData.testCases.length > 0) {
      setIsCodingQuestion(true);
    }
  }, [supportData]);

  const loadQuestion = useCallback(async () => {
    setAnswer("");
    setCode("# Write your Python solution here\n");
    setTestResults(null);
    setRunError("");
    setHintsRevealed([]);
    setShowHints(true);
    setShowSolution(false);
    setAssessment(null);
    setShowModelAnswer(false);
    setModelAnswer("");
    setMarkSchemePoints([]);
    setError("");
    setSupportReady(false);
    setSupportData(null);

    try {
      if (!sessionIdRef.current) {
        try {
          const { sessionId } = await startSession.mutateAsync({ moduleId, mode });
          sessionIdRef.current = sessionId;
        } catch {/* non-critical */}
      }

      const q = await generateQuestion.mutateAsync({ moduleId, difficulty, mode });
      const qTyped = q as unknown as Question;
      setQuestion(qTyped);

      // If cached question already has support data, mark ready immediately
      if (q.supportReady) {
        setSupportReady(true);
        setSupportData({
          hints: qTyped.hints,
          modelAnswer: qTyped.modelAnswer,
          markSchemePoints: q.markSchemePoints ?? [],
          testCases: (qTyped.testCases ?? []) as TestCase[],
        });
      } else {
        // Fire support call in background — don't await
        generateQuestionSupport.mutateAsync({ questionId: q.id }).then((support) => {
          setSupportData({
            hints: support.hints,
            modelAnswer: support.modelAnswer,
            markSchemePoints: support.markSchemePoints,
            testCases: support.testCases as TestCase[],
          });
          setSupportReady(true);
        }).catch(() => {
          // Support failed — still allow practice with limited functionality
          setSupportReady(true);
        });
      }

      setIsCodingQuestion(
        mode === "coding" ||
        (Array.isArray(qTyped.testCases) && qTyped.testCases.length > 0)
      );
      questionStartedAt.current = Date.now();
      startTimer();
    } catch {
      setError("Failed to load question. Please try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, mode, difficulty]);

  const handleEnd = useCallback(() => {
    unregisterEndSession();
    if (sessionIdRef.current) {
      endSession.mutate({ sessionId: sessionIdRef.current });
      sessionIdRef.current = null;
    }
    stopTimer();
    onEnd?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEnd]);

  const handleStart = () => {
    setStarted(true);
    registerEndSession(handleEnd);
    loadQuestion();
  };

  const handleHint = async () => {
    if (!question || hintsRevealed.length >= MAX_HINTS) return;
    try {
      if (isCodingQuestion) {
        const { hintText } = await requestCodingHint.mutateAsync({
          questionId: question.id,
          code,
          currentHintLevel: hintsRevealed.length,
          testResults: testResults ?? undefined,
        });
        setHintsRevealed((prev) => [...prev, hintText]);
      } else {
        // Theory: use pre-fetched hints from supportData first
        const hints = supportData?.hints ?? [];
        if (hintsRevealed.length < hints.length) {
          setHintsRevealed((prev) => [...prev, hints[hintsRevealed.length]]);
        } else {
          const { hintText } = await requestHint.mutateAsync({
            questionId: question.id,
            currentHintLevel: hintsRevealed.length,
          });
          setHintsRevealed((prev) => [...prev, hintText]);
        }
      }
      setShowHints(true);
    } catch {
      setError("Could not load hint.");
    }
  };

  const handleRun = async () => {
    if (!question || !code.trim()) return;
    setRunError("");
    try {
      const result = await runCode.mutateAsync({ questionId: question.id, code });
      setTestResults(result.testResults as TestResult[]);
      if (result.blocked) {
        setRunError(`Restricted: \`${result.blockReason}\` is not allowed in GCSE practice.`);
        setTestResults(null);
      } else if (result.timedOut) {
        setRunError("Code took too long — check for infinite loops.");
        setTestResults(null);
      } else if (result.stderr) {
        setRunError(result.stderr.split("\n").slice(-2).join(" "));
      }
    } catch {
      setError("Run failed. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!question) return;
    const submittedAnswer = isCodingQuestion ? code : answer;
    if (!submittedAnswer.trim()) return;
    stopTimer();
    try {
      const result = await submitAnswer.mutateAsync({
        questionId: question.id,
        sessionId: sessionIdRef.current ?? undefined,
        answer: submittedAnswer.trim(),
        hintsUsed: hintsRevealed.length,
        timeSpentSeconds: Math.round((Date.now() - questionStartedAt.current) / 1000),
      });
      setAssessment(result.assessment);
      setModelAnswer(supportData?.modelAnswer || result.modelAnswer);
      setMarkSchemePoints(supportData?.markSchemePoints ?? result.markSchemePoints ?? []);
    } catch {
      setError("Submission failed. Please try again.");
      startTimer();
    }
  };

  const hintPending = isCodingQuestion ? requestCodingHint.isPending : requestHint.isPending;

  // ── Start screen ──────────────────────────────────────────
  if (!started) {
    const accentCol = mode === "coding" ? "#059669" : "#4f46e5";
    const accentBg  = mode === "coding" ? "#d1fae5" : "#eef2ff";
    return (
      <div className="flex flex-col justify-center h-full py-12 px-2 max-w-xs mx-auto gap-6">
        <div className="flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1" style={{ backgroundColor: accentBg }}>
            <Play className="w-4 h-4" style={{ color: accentCol }} />
          </div>
          <p className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
            {mode === "coding" ? "Coding practice" : "Theory practice"}
          </p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {mode === "coding" ? "Write Python code to solve problems" : "Written exam-style questions with mark schemes"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Difficulty</p>
          <DifficultySelector value={difficulty} onChange={setDifficulty} />
        </div>

        <button
          onClick={handleStart}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: accentCol, color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Play className="w-4 h-4" />
          Start Practice
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────
  if (generateQuestion.isPending && !question) {
    return (
      <div className="space-y-4 animate-pulse py-4">
        <div className="h-4 rounded w-1/4" style={{ backgroundColor: "var(--accent)" }} />
        <div className="h-24 rounded" style={{ backgroundColor: "var(--accent)" }} />
        <div className="h-32 rounded" style={{ backgroundColor: "var(--accent)" }} />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="text-center py-12">
        <p style={{ color: "var(--muted-foreground)" }}>{error}</p>
        <button onClick={loadQuestion} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Try again
        </button>
      </div>
    );
  }

  // ── Practice UI ───────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
            {isCodingQuestion ? "Coding Practice" : "Theory Practice"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{question?.metadata.topicName}</p>
        </div>
      </div>

      {question && (
        <>
          {/* Question */}
          <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Question</span>
              <div className="flex items-center gap-2">
                {isCodingQuestion && (
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Python</span>
                )}
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: DIFFICULTY_CONFIG[difficulty].bg, color: DIFFICULTY_CONFIG[difficulty].colour, border: `1px solid ${DIFFICULTY_CONFIG[difficulty].border}` }}
                >
                  {DIFFICULTY_CONFIG[difficulty].label}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--accent)", color: "var(--muted-foreground)" }}>
                  {question.maxMarks} {question.maxMarks === 1 ? "mark" : "marks"}
                </span>
              </div>
            </div>
            <QuestionText text={question.questionText} />
          </div>

          {/* Hints */}
          {hintsRevealed.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <button onClick={() => setShowHints((v) => !v)} className="flex items-center justify-between w-full text-left px-1">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> Hints ({hintsRevealed.length})
                </span>
                <span className="text-xs text-amber-500">{showHints ? "▲" : "▼"}</span>
              </button>
              {showHints && hintsRevealed.map((hint, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <span className="text-xs font-semibold text-amber-700 mr-2">Hint {i + 1}</span>
                  <span className="text-sm text-amber-800">{hint}</span>
                </div>
              ))}
            </div>
          )}

          {/* Show solution before submission */}
          {!assessment && question.modelAnswer && (
            <div className="mb-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--accent)", border: "1px solid var(--border)" }}>
              <button onClick={() => setShowSolution((v) => !v)} className="flex items-center justify-between w-full text-left">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Show solution</p>
                <span className="text-xs text-indigo-400">{showSolution ? "▲" : "▼"}</span>
              </button>
              {showSolution && (
                isCodingQuestion ? (
                  <div className="mt-2 rounded-lg overflow-hidden border border-indigo-300">
                    <CodeEditor value={question.modelAnswer} readOnly />
                  </div>
                ) : (
                  <div className="mt-2"><QuestionText text={question.modelAnswer} /></div>
                )
              )}
            </div>
          )}

          {/* Answer area or feedback */}
          {!assessment ? (
            isCodingQuestion ? (
              <>
                <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <CodeEditor value={code} onChange={(val) => { setCode(val); setShowHints(false); }} />
                </div>

                {runError && (
                  <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-rose-700 mb-1">Error</p>
                    <p className="text-sm text-rose-800 font-mono whitespace-pre-wrap">{runError}</p>
                  </div>
                )}

                {testResults && (
                  <div className="mb-4 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide px-1 mb-2" style={{ color: "var(--muted-foreground)" }}>
                      Test Results — {testResults.filter((r) => r.passed).length}/{testResults.length} passed
                    </p>
                    {testResults.map((r, i) => (
                      <div key={i} className={`rounded-lg px-4 py-2.5 border text-sm font-mono ${r.passed ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                        <span className={`font-semibold mr-2 ${r.passed ? "text-emerald-700" : "text-rose-700"}`}>{r.passed ? "✓" : "✗"}</span>
                        {r.hidden ? (
                          <span className="text-slate-500">Hidden test</span>
                        ) : (
                          <>
                            <span className="text-slate-600">input: </span>
                            <span className="text-slate-800">{r.input || "(none)"}</span>
                            {!r.passed && (
                              <>
                                <span className="text-slate-400 mx-2">·</span>
                                <span className="text-slate-600">expected: </span>
                                <span className="text-emerald-700">{r.expectedOutput}</span>
                                <span className="text-slate-400 mx-2">·</span>
                                <span className="text-slate-600">got: </span>
                                <span className="text-rose-700">{r.actualOutput || "(no output)"}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

                <div className="flex items-center gap-3">
                  <button onClick={handleRun} disabled={runCode.isPending || !code.trim() || !supportReady}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    {runCode.isPending ? "Running..." : "Run ▶"}
                  </button>
                  <button onClick={handleHint} disabled={hintPending || hintsRevealed.length >= MAX_HINTS || (!isCodingQuestion && !supportReady)}
                    className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hintPending ? "Loading..." : hintsRevealed.length === 0 ? "Get hint" : hintsRevealed.length < MAX_HINTS ? `Hint ${hintsRevealed.length + 1}/${MAX_HINTS}` : "No more hints"}
                  </button>
                  {!supportReady && !assessment && question && (
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Preparing...
                    </span>
                  )}
                  <button onClick={handleSubmit} disabled={submitAnswer.isPending || !code.trim()}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitAnswer.isPending ? "Marking..." : "Submit →"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); setShowHints(false); setShowSolution(false); }}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full rounded-xl px-4 py-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-4"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />

                {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

                <div className="flex items-center gap-3">
                  <button onClick={handleHint} disabled={hintPending || hintsRevealed.length >= MAX_HINTS || (!isCodingQuestion && !supportReady)}
                    className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hintPending ? "Loading..." : hintsRevealed.length === 0 ? "Get hint" : hintsRevealed.length < MAX_HINTS ? `Hint ${hintsRevealed.length + 1}/${MAX_HINTS}` : "No more hints"}
                  </button>
                  {!supportReady && !assessment && question && (
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Preparing...
                    </span>
                  )}
                  <button onClick={handleSubmit} disabled={submitAnswer.isPending || !answer.trim()}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitAnswer.isPending ? "Marking..." : "Submit answer"}
                  </button>
                </div>
              </>
            )
          ) : (
            /* Feedback panel */
            <div className="space-y-3">
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`text-3xl font-bold ${assessment.awardedMarks === assessment.maxMarks ? "text-emerald-600" : assessment.awardedMarks >= assessment.maxMarks / 2 ? "text-amber-600" : "text-rose-600"}`}>
                    {assessment.awardedMarks}/{assessment.maxMarks}
                  </div>
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>marks awarded</span>
                  {hintsRevealed.length > 0 && (
                    <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {hintsRevealed.length} hint{hintsRevealed.length > 1 ? "s" : ""} used
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{assessment.feedback}</p>
              </div>

              {assessment.strengths.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">What you got right</p>
                  <ul className="space-y-1">
                    {assessment.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-800 flex gap-2"><span>✓</span><span>{s}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {assessment.missingPoints.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">Missing points</p>
                  <ul className="space-y-1">
                    {assessment.missingPoints.map((p, i) => (
                      <li key={i} className="text-sm text-rose-800 flex gap-2"><span>✗</span><span>{p}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {isCodingQuestion && (
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted-foreground)" }}>Your code</p>
                  <div className="rounded-lg overflow-hidden">
                    <CodeEditor value={code} readOnly />
                  </div>
                </div>
              )}

              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <button onClick={() => setShowModelAnswer((v) => !v)}
                  className="text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  {showModelAnswer ? "Hide model answer ▲" : "Show model answer ▼"}
                </button>
                {showModelAnswer && (
                  isCodingQuestion ? (
                    <div className="mt-3 rounded-lg overflow-hidden"><CodeEditor value={modelAnswer} readOnly /></div>
                  ) : (
                    <div className="mt-3"><QuestionText text={modelAnswer} /></div>
                  )
                )}
                {showModelAnswer && !isCodingQuestion && markSchemePoints.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Mark scheme</p>
                    <ol className="space-y-1">
                      {markSchemePoints.map((point, i) => (
                        <li key={i} className="text-xs flex gap-2" style={{ color: "var(--muted-foreground)" }}>
                          <span className="font-semibold">{i + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button onClick={loadQuestion} disabled={generateQuestion.isPending}
                  className="shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generateQuestion.isPending ? "Loading..." : "Next question →"}
                </button>
                <DifficultySelector value={difficulty} onChange={setDifficulty} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
