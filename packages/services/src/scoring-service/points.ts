import type { QuestionDifficulty } from "@gcse/database";

export const DIFFICULTY_POINTS: Record<QuestionDifficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

export function pointsForAttempt(
  difficulty: QuestionDifficulty,
  testsPassed: number,
  totalTests: number,
): number {
  if (totalTests <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, testsPassed / totalTests));
  return Math.round(DIFFICULTY_POINTS[difficulty] * ratio);
}

export function awardDelta(bestSoFar: number, thisAttempt: number): number {
  return Math.max(0, thisAttempt - bestSoFar);
}
