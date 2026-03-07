import { z } from "zod";

export const startSessionInputModel = z.object({
  moduleId: z.string(),
  mode: z.enum(["theory", "coding", "mixed", "timed", "review"]),
});

export const startSessionOutputModel = z.object({
  sessionId: z.string(),
});

export const endSessionInputModel = z.object({
  sessionId: z.string(),
});

export const endSessionOutputModel = z.object({
  success: z.boolean(),
  summary: z.object({
    questionsAttempted: z.number(),
    averageScore: z.number(),
    hintsUsed: z.number(),
  }),
});
