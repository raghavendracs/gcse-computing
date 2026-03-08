"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMe } from "~/hooks/api/auth";

export default function LandingPage() {
  const { user, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  // While checking auth, show nothing (prevents flash)
  if (isLoading) {
    return null;
  }

  // If user is logged in, redirect is in progress
  if (user) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-4 h-14 flex items-center justify-between max-w-5xl mx-auto">
        <span className="font-bold text-indigo-600 text-lg tracking-tight">GCSE CS</span>
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
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-4">
          Ace your GCSE<br />
          <span className="text-indigo-600">Computer Science</span>
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-xl mx-auto">
          AI-powered practice questions aligned to your exam board. Get instant feedback, track your progress, and target your weak areas.
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
              <span className="text-indigo-600 text-xl">📋</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Exam board aligned</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Questions mapped directly to the Edexcel, AQA, and OCR GCSE Computer Science specifications. Nothing irrelevant, nothing missing.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">🤖</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">AI feedback on every answer</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Every answer you submit gets detailed AI marking — strengths, missing points, and a score — so you know exactly where to improve.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">📈</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Track your progress</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              See your mastery per topic, identify weak areas automatically, and keep your revision streak going day by day.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
