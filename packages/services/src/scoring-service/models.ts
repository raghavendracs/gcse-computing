import { z } from "zod";

export const applyAttemptInput = z.object({
  userId: z.string(),
  questionId: z.string(),
  topicId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  testsPassed: z.number().int().min(0),
  totalTests: z.number().int().min(0),
});
export type ApplyAttemptInput = z.infer<typeof applyAttemptInput>;

export interface ApplyAttemptResult {
  pointsThisAttempt: number;
  delta: number;
  newBest: number;
  solved: boolean;
  newTotalPoints: number;
}
