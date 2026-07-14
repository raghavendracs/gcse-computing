"use client";
import Link from "next/link";
import { useLeaderboard } from "~/hooks/api/leaderboard";

const MEDAL: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-amber-100", text: "text-amber-700", label: "🥇" },
  2: { bg: "bg-slate-100", text: "text-slate-600", label: "🥈" },
  3: { bg: "bg-orange-100", text: "text-orange-700", label: "🥉" },
};

export default function LandingPage() {
  const { entries, isLoading } = useLeaderboard(10);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-4 h-14 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Ace GCSE Computing" className="w-8 h-8 rounded-lg object-contain" />
          <p className="font-bold text-slate-900 text-sm tracking-tight">Ace GCSE Computing</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Ace GCSE Computing" className="w-18 h-18 rounded-2xl shadow-md object-contain" />
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-4">
          Ace GCSE Computing
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-xl mx-auto">
          Master Python programming through hands-on practice. Write real code, get instant results from automated test cases, and climb the leaderboard as you improve.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/signup"
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-white text-slate-700 rounded-xl font-semibold text-base border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">🌳</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Deep topic coverage</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Hundreds of Python challenges spanning variables, loops, functions, data structures, algorithms, and more — organised into a structured topic tree so you always know what to tackle next.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">⚡</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Instant automated marking</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your code runs against normal and edge-case test cases the moment you submit. See exactly which tests pass and which fail — no waiting, no guessing.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">🏆</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Earn points, climb the ranks</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Every question you solve earns points. Watch your score grow, compete on the public leaderboard, and see how you stack up against everyone else on the platform.
            </p>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Top coders</h2>
          <p className="text-sm text-slate-500 text-center mb-8">
            The highest scorers across the platform — updated in real time.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl px-5 py-4 animate-pulse flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                  <div className="flex-1 h-4 bg-slate-200 rounded" />
                  <div className="w-16 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl px-6 py-10 text-center">
              <p className="text-slate-500 mb-4">
                No scores yet — be the first on the board.
              </p>
              <Link
                href="/signup"
                className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
              >
                Sign up and start solving
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const medal = MEDAL[entry.rank];
                return (
                  <div
                    key={entry.rank}
                    className="bg-slate-50 rounded-2xl px-5 py-3.5 flex items-center gap-4"
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        medal
                          ? `${medal.bg} ${medal.text}`
                          : "bg-white text-slate-400 border border-slate-200"
                      }`}
                    >
                      {medal ? medal.label : entry.rank}
                    </span>
                    <span className="flex-1 font-medium text-slate-800 text-sm truncate">
                      {entry.displayName}
                    </span>
                    <span className="text-sm font-semibold text-indigo-600 shrink-0">
                      {entry.totalPoints} pts
                    </span>
                  </div>
                );
              })}
              <div className="pt-4 text-center">
                <Link
                  href="/signup"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Sign up to climb the board →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
