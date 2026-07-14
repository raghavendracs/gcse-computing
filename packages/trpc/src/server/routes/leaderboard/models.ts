import { z } from "zod";

export const leaderboardInputModel = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});

export const leaderboardOutputModel = z.array(
  z.object({
    rank: z.number(),
    displayName: z.string(),
    totalPoints: z.number(),
  }),
);
