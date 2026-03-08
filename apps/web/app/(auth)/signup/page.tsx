"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignup } from "~/hooks/api/auth";
import Link from "next/link";

type AIPreference = "accurate" | "balanced" | "budget";

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    aiModelPreference: "balanced" as AIPreference,
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signup.mutateAsync(form);
      router.push("/login?registered=true");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      setError(msg);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Create parent account
      </h1>
      <p className="text-slate-500 mb-6">
        You&apos;ll add student profiles after signing up
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-400 mt-1">Minimum 8 characters</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            AI quality
          </label>
          <select
            value={form.aiModelPreference}
            onChange={(e) =>
              setForm({
                ...form,
                aiModelPreference: e.target.value as AIPreference,
              })
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-slate-900"
          >
            <option value="accurate">Accurate (best quality)</option>
            <option value="balanced">Balanced (recommended)</option>
            <option value="budget">Budget (faster, lower cost)</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Controls which AI model generates and marks questions
          </p>
        </div>
        {error && (
          <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
        >
          {signup.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
