"use client";
import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";
import { trpc } from "~/trpc/client";

interface PracticeTimerContextType {
  timeSpent: number;
  timerReady: boolean;
  isRunning: boolean;
  totalAttempts: number;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  activeEndSession: (() => void) | null;
  registerEndSession: (fn: () => void) => void;
  unregisterEndSession: () => void;
}

const PracticeTimerContext = createContext<PracticeTimerContextType>({
  timeSpent: 0,
  timerReady: false,
  isRunning: false,
  totalAttempts: 0,
  startTimer: () => {},
  stopTimer: () => {},
  resetTimer: () => {},
  activeEndSession: null,
  registerEndSession: () => {},
  unregisterEndSession: () => {},
});

export function PracticeTimerProvider({ children }: { children: ReactNode }) {
  const [timerDelta, setTimerDelta] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activeEndSession, setActiveEndSession] = useState<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: totalTimeData, isError, isSuccess } = trpc.sessions.getTotalTimeSpent.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const timerReady = isSuccess || isError;
  const timeSpent = (totalTimeData?.totalSeconds ?? 0) + timerDelta;
  const totalAttempts = totalTimeData?.totalAttempts ?? 0;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    setIsRunning(true);
    timerRef.current = setInterval(() => setTimerDelta((d) => d + 1), 1000);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerDelta(0);
    setIsRunning(false);
  }, []);

  const registerEndSession = useCallback((fn: () => void) => {
    setActiveEndSession(() => fn);
  }, []);

  const unregisterEndSession = useCallback(() => {
    setActiveEndSession(null);
  }, []);

  return (
    <PracticeTimerContext.Provider value={{ timeSpent, timerReady, isRunning, totalAttempts, startTimer, stopTimer, resetTimer, activeEndSession, registerEndSession, unregisterEndSession }}>
      {children}
    </PracticeTimerContext.Provider>
  );
}

export function usePracticeTimer() {
  return useContext(PracticeTimerContext);
}
