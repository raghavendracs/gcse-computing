"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGetModule } from "~/hooks/api/modules";
import { useStartSession } from "~/hooks/api/sessions";

const TOPIC_TYPE_LABEL: Record<string, string> = {
  theory: "Theory",
  programming: "Coding",
  mixed: "Mixed",
};

const DIFFICULTY_COLOUR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const { module, isLoading } = useGetModule(moduleId);
  const startSession = useStartSession();

  const handleStart = async (mode: "theory" | "coding") => {
    const { sessionId } = await startSession.mutateAsync({ moduleId, mode });
    const path = mode === "coding" ? "coding" : "practice";
    router.push(`/modules/${moduleId}/${path}?sessionId=${sessionId}&mode=${mode}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/2" />
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-24 bg-slate-200 rounded" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">Module not found</p>
        <Link href="/dashboard" className="text-indigo-600 text-sm mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-600 mb-6 inline-block">
        ← Dashboard
      </Link>

      {/* Module header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
            {module.moduleCode}
          </span>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {TOPIC_TYPE_LABEL[module.topicType] ?? module.topicType}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{module.moduleName}</h1>
        <p className="text-slate-500 mt-1">{module.topicName}</p>
        <p className="text-slate-600 mt-3 text-sm leading-relaxed">{module.description}</p>

        {/* Difficulty bands */}
        {module.difficultyBands?.length > 0 && (
          <div className="flex gap-2 mt-4">
            {module.difficultyBands.map((d) => (
              <span
                key={d}
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${DIFFICULTY_COLOUR[d] ?? "bg-slate-100 text-slate-600"}`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Practice mode picker */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Choose practice mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Theory — active */}
          <button
            onClick={() => handleStart("theory")}
            disabled={startSession.isPending}
            className="flex flex-col items-start p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
          >
            <span className="text-2xl mb-2">📖</span>
            <span className="font-semibold text-slate-900">Theory</span>
            <span className="text-xs text-slate-500 mt-1">Short-answer & extended questions</span>
          </button>

          {/* Coding — active */}
          <button
            onClick={() => handleStart("coding")}
            disabled={startSession.isPending}
            className="flex flex-col items-start p-5 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
          >
            <span className="text-2xl mb-2">💻</span>
            <span className="font-semibold text-slate-900">Coding</span>
            <span className="text-xs text-slate-500 mt-1">Python programming questions</span>
          </button>

          {/* Mixed — coming in Phase 3 */}
          <div className="flex flex-col items-start p-5 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed">
            <span className="text-2xl mb-2">🔀</span>
            <span className="font-semibold text-slate-600">Mixed</span>
            <span className="text-xs text-slate-400 mt-1">Coming in Phase 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
