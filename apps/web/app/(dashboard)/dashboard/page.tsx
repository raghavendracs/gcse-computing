"use client";
import { useState } from "react";
import { useMe } from "~/hooks/api/auth";
import { useListModules } from "~/hooks/api/modules";
import { ModuleCard } from "~/components/module-card";

type FilterType = "all" | "theory" | "programming" | "mixed";

const filterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "theory", label: "Theory" },
  { value: "programming", label: "Coding" },
  { value: "mixed", label: "Mixed" },
];

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

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div>
      {/* Greeting */}
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

      {/* Filter tabs */}
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

      {/* Module grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 bg-slate-200 rounded-xl animate-pulse"
            />
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
