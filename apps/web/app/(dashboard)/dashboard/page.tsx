"use client";
import { useState } from "react";
import Link from "next/link";
import { useMe, useStudents, useCreateStudent } from "~/hooks/api/auth";
import { useGetProgress } from "~/hooks/api/progress";
import { useGetCurriculum } from "~/hooks/api/curriculum";

type ExamBoard = "OCR" | "AQA" | "Edexcel";

const SECTION_LABELS: Record<string, string> = {
  "1": "Topic 1 — Computational Thinking",
  "2": "Topic 2 — Data",
  "3": "Topic 3 — Computers",
  "4": "Topic 4 — Networks",
  "5": "Topic 5 — Issues and Impact",
  "6": "Topic 6 — Problem Solving with Programming",
};

function MasteryBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const colour = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 w-20">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right shrink-0">{Math.round(pct)}%</span>
    </div>
  );
}

function ParentDashboard() {
  const { students, isLoading } = useStudents();
  const createStudent = useCreateStudent();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    examBoardPreference: "OCR" as ExamBoard,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await createStudent.mutateAsync(form);
      setSuccess(`Student account created for ${form.fullName}. They can now log in with ${form.email}.`);
      setForm({ fullName: "", email: "", password: "", examBoardPreference: "OCR" });
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create student");
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Parent Dashboard</h1>
        <p className="text-slate-500 mt-1">Manage your students</p>
      </div>

      {success && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Students</h2>
          <button
            onClick={() => { setShowForm((v) => !v); setError(""); }}
            className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {showForm ? "Cancel" : "+ Add student"}
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-slate-200 rounded-xl" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
            <p className="font-medium">No students yet</p>
            <p className="text-sm mt-1">Add your first student to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((s: { id: string; fullName: string; email: string; examBoardPreference?: string }) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {s.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{s.fullName}</p>
                  <p className="text-xs text-slate-400">{s.email} · {s.examBoardPreference ?? "OCR"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-800 mb-4">New student account</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-900"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Exam board</label>
              <select
                value={form.examBoardPreference}
                onChange={(e) => setForm({ ...form, examBoardPreference: e.target.value as ExamBoard })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-900"
              >
                <option value="OCR">OCR</option>
                <option value="AQA">AQA</option>
                <option value="Edexcel">Edexcel</option>
              </select>
            </div>
            {error && <p className="text-rose-600 text-sm bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={createStudent.isPending}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createStudent.isPending ? "Creating…" : "Create student account"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useMe();
  const { progress } = useGetProgress();
  const examBoard = (user?.examBoardPreference as ExamBoard) ?? "Edexcel";
  const { topics, isLoading } = useGetCurriculum(examBoard);

  // Track which topic sections are expanded (all collapsed by default)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (user?.role === "parent") {
    return <ParentDashboard />;
  }

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  // Build moduleScore map from progress
  const moduleScoreMap = new Map<string, number>();
  if (progress) {
    for (const mp of progress.moduleProgress) {
      moduleScoreMap.set(mp.moduleId, mp.averageScore);
    }
  }

  function topicMastery(moduleIds: string[]): number | null {
    if (moduleIds.length === 0) return null;
    const scores = moduleIds
      .map((id) => moduleScoreMap.get(id))
      .filter((s): s is number => s !== undefined);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Group topics into sections by first digit of code
  const sectionNums = [...new Set(topics.map((t) => t.code.split(".")[0]))];

  const sections = sectionNums.map((num) => {
    const sectionTopics = topics.filter((t) => t.code.startsWith(`${num}.`));
    // Group subtopics by topicGroupTitle
    const groups = sectionTopics.reduce<Record<string, typeof topics>>((acc, t) => {
      if (!acc[t.topicGroupTitle]) acc[t.topicGroupTitle] = [];
      acc[t.topicGroupTitle].push(t);
      return acc;
    }, {});
    // All moduleIds for this whole section (for topic-level Practice)
    const allModuleIds = [...new Set(sectionTopics.flatMap((t) => t.moduleIds))];
    return { num, label: SECTION_LABELS[num] ?? `Topic ${num}`, groups: Object.entries(groups), allModuleIds, isProgramming: num === "6" };
  });

  const toggleSection = (num: string) =>
    setExpanded((prev) => ({ ...prev, [num]: !prev[num] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Hi {firstName} 👋</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {user?.examBoardPreference && (
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
              {user.examBoardPreference}
            </span>
          )}
          {progress && user?.role === "student" && (
            <Link
              href="/progress"
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-indigo-300 transition-colors"
            >
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-600 leading-none">{progress.streak.currentDays}</p>
                <p className="text-xs text-slate-400">streak</p>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800 leading-none">{progress.totalAttempts}</p>
                <p className="text-xs text-slate-400">attempts</p>
              </div>
              <span className="text-slate-300 text-sm ml-1">›</span>
            </Link>
          )}
        </div>
      </div>

      {/* Curriculum */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 bg-slate-200 rounded-xl" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No curriculum loaded</p>
          <p className="text-sm mt-1">Spec topics haven&apos;t been seeded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map(({ num, label, groups, allModuleIds, isProgramming }) => {
            const isOpen = !!expanded[num];
            const sectionMastery = topicMastery(allModuleIds);
            const firstModuleId = allModuleIds[0];

            return (
              <div key={num} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Topic header — clickable to expand/collapse */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  onClick={() => toggleSection(num)}
                >
                  <span className="text-slate-400 text-sm w-4 shrink-0">{isOpen ? "▾" : "▸"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{label}</p>
                    <p className="text-xs text-slate-400">{isProgramming ? "Paper 02 — Programming" : "Paper 01 — Theory"}</p>
                  </div>
                  {sectionMastery !== null && <MasteryBar score={sectionMastery} />}
                  <Link
                    href={`/modules/${firstModuleId ?? ""}`}
                    onClick={(e) => { if (!firstModuleId) e.preventDefault(); e.stopPropagation(); }}
                    className="shrink-0 text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Practice
                  </Link>
                </div>

                {/* Subtopics — shown when expanded */}
                {isOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {groups.map(([groupTitle, groupTopics]) => (
                      <div key={groupTitle}>
                        <div className="px-5 py-1.5 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{groupTitle}</p>
                        </div>
                        {groupTopics.map((topic) => {
                          const mastery = topicMastery(topic.moduleIds);
                          const firstId = topic.moduleIds[0];
                          return (
                            <div key={topic.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                              <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded shrink-0">
                                {topic.code}
                              </span>
                              <span className="flex-1 text-sm text-slate-700">
                                {topic.title}
                              </span>
                              {mastery !== null && <MasteryBar score={mastery} />}
                              {firstId && (
                                <Link
                                  href={`/modules/${firstId}`}
                                  className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                >
                                  Practice →
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
