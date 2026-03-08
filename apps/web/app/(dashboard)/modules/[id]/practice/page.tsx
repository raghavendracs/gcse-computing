"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useGenerateQuestion, useSubmitAnswer, useRequestHint, useRunCode, useRequestCodingHint } from "~/hooks/api/questions";
import { useEndSession } from "~/hooks/api/sessions";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("../coding/CodeEditor"), { ssr: false });

const MAX_HINTS = 3;

type TestCase = { input: string; expectedOutput: string; hidden: boolean };

type Question = {
  id: string;
  questionText: string;
  maxMarks: number;
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

export default function PracticePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const moduleId = params.id as string;
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const [question, setQuestion] = useState<Question | null>(null);
  const [isCodingQuestion, setIsCodingQuestion] = useState(false);

  // Theory state
  const [answer, setAnswer] = useState("");

  // Coding state
  const [code, setCode] = useState("# Write your Python solution here\n");
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [runError, setRunError] = useState("");

  // Shared state
  const [hintsRevealed, setHintsRevealed] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modelAnswer, setModelAnswer] = useState("");
  const [markSchemePoints, setMarkSchemePoints] = useState<string[]>([]);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQuestion = useGenerateQuestion();
  const submitAnswer = useSubmitAnswer();
  const requestHint = useRequestHint();
  const runCode = useRunCode();
  const requestCodingHint = useRequestCodingHint();
  const endSession = useEndSession();

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimeSpent((t) => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

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
    setTimeSpent(0);
    stopTimer();

    const mode = Math.random() < 0.5 ? "theory" : "coding";
    try {
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium", mode });
      const qTyped = q as unknown as Question;
      setQuestion(qTyped);
      setIsCodingQuestion(Array.isArray(qTyped.testCases) && qTyped.testCases.length > 0);
      startTimer();
    } catch {
      setError("Failed to load question. Please try again.");
    }
  }, [moduleId, generateQuestion, startTimer, stopTimer]);

  useEffect(() => {
    loadQuestion();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

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
        const { hintText } = await requestHint.mutateAsync({
          questionId: question.id,
          currentHintLevel: hintsRevealed.length,
        });
        setHintsRevealed((prev) => [...prev, hintText]);
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
        sessionId,
        answer: submittedAnswer.trim(),
        hintsUsed: hintsRevealed.length,
        timeSpentSeconds: timeSpent,
      });
      setAssessment(result.assessment);
      setModelAnswer(result.modelAnswer);
      if ("markSchemePoints" in result) setMarkSchemePoints(result.markSchemePoints as string[]);
    } catch {
      setError("Submission failed. Please try again.");
      startTimer();
    }
  };

  const handleEndSession = async () => {
    try {
      if (sessionId) await endSession.mutateAsync({ sessionId });
    } finally {
      router.push("/dashboard");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const hintPending = isCodingQuestion ? requestCodingHint.isPending : requestHint.isPending;

  if (generateQuestion.isPending && !question) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-24 bg-slate-200 rounded" />
        <div className="h-32 bg-slate-200 rounded" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="max-w-2xl text-center py-16">
        <p className="text-slate-500">{error}</p>
        <button onClick={loadQuestion} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            {isCodingQuestion ? "Coding Practice" : "Theory Practice"}
          </p>
          <p className="text-sm text-slate-500">{question?.metadata.topicName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 tabular-nums">{formatTime(timeSpent)}</span>
          <button onClick={handleEndSession} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            End session
          </button>
        </div>
      </div>

      {question && (
        <>
          {/* Question */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Question</span>
              <div className="flex items-center gap-2">
                {isCodingQuestion && (
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Python</span>
                )}
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {question.maxMarks} {question.maxMarks === 1 ? "mark" : "marks"}
                </span>
              </div>
            </div>
            <p className="text-slate-800 leading-relaxed">{question.questionText}</p>
          </div>

          {/* Hints */}
          {hintsRevealed.length > 0 && (
            <div className="mb-4 space-y-2">
              <button
                onClick={() => setShowHints((v) => !v)}
                className="flex items-center justify-between w-full text-left px-1"
              >
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Hints ({hintsRevealed.length})
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

          {/* Show solution (always available before submission) */}
          {!assessment && question.modelAnswer && (
            <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
              <button
                onClick={() => setShowSolution((v) => !v)}
                className="flex items-center justify-between w-full text-left"
              >
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Show solution</p>
                <span className="text-xs text-indigo-500">{showSolution ? "▲" : "▼"}</span>
              </button>
              {showSolution && (
                isCodingQuestion ? (
                  <pre className="mt-2 text-sm text-indigo-900 font-mono whitespace-pre-wrap bg-indigo-100 rounded-lg p-3">
                    {question.modelAnswer}
                  </pre>
                ) : (
                  <p className="mt-2 text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">
                    {question.modelAnswer}
                  </p>
                )
              )}
            </div>
          )}

          {/* Answer area or feedback */}
          {!assessment ? (
            isCodingQuestion ? (
              <>
                {/* Code editor */}
                <div className="mb-4 rounded-xl overflow-hidden border border-slate-200">
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mb-2">
                      Test Results — {testResults.filter((r) => r.passed).length}/{testResults.length} passed
                    </p>
                    {testResults.map((r, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-4 py-2.5 border text-sm font-mono ${r.passed ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}
                      >
                        <span className={`font-semibold mr-2 ${r.passed ? "text-emerald-700" : "text-rose-700"}`}>
                          {r.passed ? "✓" : "✗"}
                        </span>
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
                  <button
                    onClick={handleRun}
                    disabled={runCode.isPending || !code.trim()}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {runCode.isPending ? "Running..." : "Run ▶"}
                  </button>
                  <button
                    onClick={handleHint}
                    disabled={hintPending || hintsRevealed.length >= MAX_HINTS}
                    className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hintPending
                      ? "Loading..."
                      : hintsRevealed.length === 0
                        ? "Get hint"
                        : hintsRevealed.length < MAX_HINTS
                          ? `Hint ${hintsRevealed.length + 1} of ${MAX_HINTS}`
                          : "No more hints"}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitAnswer.isPending || !code.trim()}
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
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-4"
                />

                {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleHint}
                    disabled={hintPending || hintsRevealed.length >= MAX_HINTS}
                    className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hintPending
                      ? "Loading..."
                      : hintsRevealed.length === 0
                        ? "Get hint"
                        : hintsRevealed.length < MAX_HINTS
                          ? `Hint ${hintsRevealed.length + 1} of ${MAX_HINTS}`
                          : "No more hints"}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitAnswer.isPending || !answer.trim()}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitAnswer.isPending ? "Marking..." : "Submit answer"}
                  </button>
                </div>
              </>
            )
          ) : (
            /* Feedback panel */
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`text-3xl font-bold ${
                      assessment.awardedMarks === assessment.maxMarks
                        ? "text-emerald-600"
                        : assessment.awardedMarks >= assessment.maxMarks / 2
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {assessment.awardedMarks}/{assessment.maxMarks}
                  </div>
                  <span className="text-sm text-slate-500">marks awarded</span>
                  {hintsRevealed.length > 0 && (
                    <span className="ml-auto text-xs text-slate-400">
                      {hintsRevealed.length} hint{hintsRevealed.length > 1 ? "s" : ""} used
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{assessment.feedback}</p>
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
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your code</p>
                  <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{code}</pre>
                </div>
              )}

              {/* Model answer toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <button
                  onClick={() => setShowModelAnswer((v) => !v)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {showModelAnswer ? "Hide model answer ▲" : "Show model answer ▼"}
                </button>
                {showModelAnswer && (
                  isCodingQuestion ? (
                    <pre className="mt-3 text-sm text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                      {modelAnswer}
                    </pre>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{modelAnswer}</p>
                  )
                )}
                {showModelAnswer && !isCodingQuestion && markSchemePoints.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mark scheme</p>
                    <ol className="space-y-1">
                      {markSchemePoints.map((point, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-2">
                          <span className="font-semibold text-slate-400">{i + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={loadQuestion}
                  disabled={generateQuestion.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generateQuestion.isPending ? "Loading..." : "Next question →"}
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  End session
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
