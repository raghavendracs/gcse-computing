"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimerProvider } from "~/contexts/PracticeTimerContext";
import { useMe } from "~/hooks/api/auth";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return <>{children}</>;
}

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return (
    <PracticeTimerProvider>
      <AuthGuard>{children}</AuthGuard>
    </PracticeTimerProvider>
  );
}
