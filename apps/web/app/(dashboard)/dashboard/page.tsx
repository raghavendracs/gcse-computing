"use client";
import { useState } from "react";
import { useMe, useStudents, useCreateStudent } from "~/hooks/api/auth";
import { useListModules } from "~/hooks/api/modules";
import { ModuleCard } from "~/components/module-card";

type AIPreference = "accurate" | "balanced" | "budget";
type ExamBoard = "OCR" | "AQA" | "Edexcel";
type FilterType = "all" | "theory" | "programming" | "mixed";

const filterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "theory", label: "Theory" },
  { value: "programming", label: "Coding" },
  { value: "mixed", label: "Mixed" },
];

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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Exam board</label>
              <select
                value={form.examBoardPreference}
                onChange={(e) => setForm({ ...form, examBoardPreference: e.target.value as ExamBoard })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
  const [filter, setFilter] = useState<FilterType>("all");

  const { modules, isLoading } = useListModules(
    filter === "all"
      ? { examBoard: user?.examBoardPreference ?? undefined }
      : {
          topicType: filter,
          examBoard: user?.examBoardPreference ?? undefined,
        },
  );

  if (user?.role === "parent") {
    return <ParentDashboard />;
  }

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Hi {firstName} 👋
        </h1>
        <p className="text-slate-500 mt-1">
          What would you like to study today?
        </p>
        {user?.examBoardPreference && (
          <span className="inline-block mt-2 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
            {user.examBoardPreference}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filter === opt.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No modules found</p>
          <p className="text-sm mt-1">Try a different filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              id={m.id}
              moduleName={m.moduleName}
              topicName={m.topicName}
              topicType={m.topicType}
              description={m.description}
              difficultyBands={m.difficultyBands}
            />
          ))}
        </div>
      )}
    </div>
  );
}
