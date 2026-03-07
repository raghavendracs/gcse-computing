"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useGenerateQuestion, useSubmitAnswer, useRequestHint } from "~/hooks/api/questions";
import { useEndSession } from "~/hooks/api/sessions";

type Question = {
  id: string;
  questionText: string;
  maxMarks: number;
  modelAnswer: string;
  hints: string[];
  metadata: { topicName: string; examBoard: string };
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
  const [answer, setAnswer] = useState("");
  const [hintsRevealed, setHintsRevealed] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modelAnswer, setModelAnswer] = useState("");
  const [markSchemePoints, setMarkSchemePoints] = useState<string[]>([]);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [showSuggestedAnswer, setShowSuggestedAnswer] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [timeSpent, setTimeSpent] = useState(0);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQuestion = useGenerateQuestion();
  const submitAnswer = useSubmitAnswer();
  const requestHint = useRequestHint();
  const endSession = useEndSession();

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimeSpent((t) => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const loadQuestion = useCallback(async () => {
    setAnswer("");
    setHintsRevealed([]);
    setAssessment(null);
    setShowModelAnswer(false);
    setShowSuggestedAnswer(false);
    setShowHints(true);
    setModelAnswer("");
    setMarkSchemePoints([]);
    setError("");
    setTimeSpent(0);
    stopTimer();

    try {
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium" });
      setQuestion(q);
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
    if (!question || hintsRevealed.length >= 5) return;
    try {
      const { hintText } = await requestHint.mutateAsync({
        questionId: question.id,
        currentHintLevel: hintsRevealed.length,
      });
      setHintsRevealed((prev) => {
        const next = [...prev, hintText];
        if (next.length >= 5) setShowSuggestedAnswer(true);
        return next;
      });
      setShowHints(true);
    } catch {
      setError("Could not load hint.");
    }
  };

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;
    stopTimer();
    try {
      const result = await submitAnswer.mutateAsync({
        questionId: question.id,
        sessionId,
        answer: answer.trim(),
        hintsUsed: hintsRevealed.length,
        timeSpentSeconds: timeSpent,
      });
      setAssessment(result.assessment);
      setModelAnswer(result.modelAnswer);
      setMarkSchemePoints(result.markSchemePoints);
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
        <button
          onClick={loadQuestion}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
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
          <p className="text-xs text-slate-400 uppercase tracking-wide">Theory Practice</p>
          <p className="text-sm text-slate-500">{question?.metadata.topicName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 tabular-nums">{formatTime(timeSpent)}</span>
          <button
            onClick={handleEndSession}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
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
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                {question.maxMarks} {question.maxMarks === 1 ? "mark" : "marks"}
              </span>
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
              {hintsRevealed.length >= 5 && question.modelAnswer && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mt-2">
                  <button
                    onClick={() => setShowSuggestedAnswer((v) => !v)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                      Suggested answer
                    </p>
                    <span className="text-xs text-indigo-500">{showSuggestedAnswer ? "▲" : "▼"}</span>
                  </button>
                  {showSuggestedAnswer && (
                    <p className="mt-2 text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">
                      {question.modelAnswer}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Answer area or feedback */}
          {!assessment ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => { setAnswer(e.target.value); setShowHints(false); setShowSuggestedAnswer(false); }}
                placeholder="Type your answer here..."
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-4"
              />

              {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

              <div className="flex items-center gap-3">
                {/* Hint button */}
                <button
                  onClick={handleHint}
                  disabled={requestHint.isPending || hintsRevealed.length >= 5}
                  className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestHint.isPending
                    ? "Loading..."
                    : hintsRevealed.length === 0
                      ? "Get hint"
                      : hintsRevealed.length < 5
                        ? `Hint ${hintsRevealed.length + 1} of 5`
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
          ) : (
            /* Feedback panel */
            <div className="space-y-4">
              {/* Score */}
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

              {/* Strengths */}
              {assessment.strengths.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                    What you got right
                  </p>
                  <ul className="space-y-1">
                    {assessment.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-800 flex gap-2">
                        <span>✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing points */}
              {assessment.missingPoints.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
                    Missing points
                  </p>
                  <ul className="space-y-1">
                    {assessment.missingPoints.map((p, i) => (
                      <li key={i} className="text-sm text-rose-800 flex gap-2">
                        <span>✗</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
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
                  <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {modelAnswer}
                  </p>
                )}
                {showModelAnswer && markSchemePoints.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Mark scheme
                    </p>
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

              {/* Next / End actions */}
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
