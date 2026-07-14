"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, Sun, Moon, Monitor, LogOut, X, Check, Loader2 } from "lucide-react";
import { useLogout, useMe, useUpdateProfile } from "~/hooks/api/auth";
import { usePracticeTimer } from "~/contexts/PracticeTimerContext";

type Theme = "system" | "light" | "dark";

function applyTheme(t: Theme) {
  const isDark =
    t === "dark" ||
    (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useMe();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({ fullName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)] text-sm">Account settings</h2>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Email</label>
            <input type="email" value={user?.email ?? ""} disabled
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--muted-foreground)] bg-[var(--accent)] cursor-not-allowed" />
          </div>
          <button type="submit" disabled={updateProfile.isPending}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {updateProfile.isPending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>) : saved ? (<><Check className="w-4 h-4" /> Saved</>) : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}


function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Nav() {
  const { user } = useMe();
  const logout = useLogout();
  const { activeEndSession } = usePracticeTimer();
  const initials = getInitials(user?.fullName);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) ?? "system";
    }
    return "system";
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const themeOptions: { value: Theme; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "system", icon: Monitor },
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
  ];

  return (
    <>
      <nav className="border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: "color-mix(in srgb, var(--background) 90%, transparent)" }}>
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="Ace GCSE Computing" className="w-7 h-7 rounded-md object-contain" />
            <p className="font-semibold text-[var(--foreground)] text-sm tracking-tight">Ace GCSE Computing</p>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">

            {/* End session button — only when a session is active */}
            {activeEndSession && (
              <button
                onClick={activeEndSession}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={{ backgroundColor: "var(--accent)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#fee2e2"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "#fca5a5"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                End session
              </button>
            )}

            {/* Avatar dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm select-none hover:bg-indigo-700 transition-colors"
              >
                {initials}
              </button>

              {open && (
                <div className="absolute right-0 top-11 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-20">
                  <div className="px-3 py-3 border-b border-[var(--border)]">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{user?.fullName}</p>
                    <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setOpen(false); setShowSettings(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                      Settings
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm text-[var(--foreground)] flex-1">Theme</span>
                      <div className="flex gap-0.5 bg-[var(--accent)] rounded-lg p-0.5">
                        {themeOptions.map(({ value, icon: Icon }) => (
                          <button key={value} onClick={() => setTheme(value)} title={value.charAt(0).toUpperCase() + value.slice(1)}
                            className={`p-1.5 rounded-md transition-colors ${theme === value ? "bg-[var(--card)] shadow-sm text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border)]">
                    <button
                      onClick={() => { setOpen(false); logout.mutate(); }}
                      disabled={logout.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-[var(--accent)] transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
