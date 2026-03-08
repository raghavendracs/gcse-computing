"use client";
import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from "react";
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
  const [timeSpent, setTimeSpent] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [activeEndSession, setActiveEndSession] = useState<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  const { data: totalTimeData, isError, isSuccess } = trpc.sessions.getTotalTimeSpent.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  useEffect(() => {
    if (initializedRef.current) return;
    if (isSuccess && totalTimeData !== undefined) {
      initializedRef.current = true;
      setTimeSpent(totalTimeData.totalSeconds);
      setTotalAttempts(totalTimeData.totalAttempts);
      setTimerReady(true);
    } else if (isError) {
      initializedRef.current = true;
      setTimerReady(true);
    }
  }, [isSuccess, isError, totalTimeData]);

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
    timerRef.current = setInterval(() => setTimeSpent((t) => t + 1), 1000);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeSpent(0);
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
