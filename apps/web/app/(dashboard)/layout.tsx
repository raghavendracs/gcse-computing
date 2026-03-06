import { Nav } from "~/components/nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
