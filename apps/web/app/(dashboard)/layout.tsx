import { Nav } from "~/components/nav";
import { DashboardProviders } from "./providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProviders>
      <div className="min-h-screen" style={{ backgroundColor: "var(--muted)" }}>
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </div>
    </DashboardProviders>
  );
}
