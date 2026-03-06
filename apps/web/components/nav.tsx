"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout, useMe } from "~/hooks/api/auth";

const navLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/modules", label: "Modules" },
  { href: "/history", label: "History" },
  { href: "/progress", label: "Progress" },
];

export function Nav() {
  const { user } = useMe();
  const logout = useLogout();
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-indigo-600 text-lg tracking-tight">
          GCSE CS
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:block">
            {user?.fullName}
          </span>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
