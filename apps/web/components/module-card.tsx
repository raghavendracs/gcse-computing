import Link from "next/link";

interface ModuleCardProps {
  id: string;
  moduleName: string;
  topicName: string;
  topicType: "theory" | "programming" | "mixed";
  description: string;
  difficultyBands: string[];
}

const typeStyles: Record<string, string> = {
  theory: "bg-blue-100 text-blue-700",
  programming: "bg-green-100 text-green-700",
  mixed: "bg-purple-100 text-purple-700",
};

const typeLabel: Record<string, string> = {
  theory: "Theory",
  programming: "Coding",
  mixed: "Mixed",
};

export function ModuleCard({
  id,
  moduleName,
  topicName,
  topicType,
  description,
  difficultyBands,
}: ModuleCardProps) {
  return (
    <Link href={`/modules/${id}`}>
      <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {moduleName}
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${typeStyles[topicType] ?? "bg-slate-100 text-slate-600"}`}
          >
            {typeLabel[topicType] ?? topicType}
          </span>
        </div>
        <h3 className="font-semibold text-slate-900 mb-1 text-sm leading-snug">
          {topicName}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-2 flex-1">{description}</p>
        <div className="mt-3 flex gap-1">
          {difficultyBands.map((d) => (
            <span
              key={d}
              className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded capitalize"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
