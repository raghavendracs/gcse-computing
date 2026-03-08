"use client";
import { PracticeTimerProvider } from "~/contexts/PracticeTimerContext";

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return <PracticeTimerProvider>{children}</PracticeTimerProvider>;
}
