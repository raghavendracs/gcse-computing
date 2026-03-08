import { z } from "zod";

export const startSessionInputModel = z.object({
  moduleId: z.string().optional(),
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

export const listSessionsInputModel = z.object({
  studentId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
});

const sessionItemModel = z.object({
  id: z.string(),
  mode: z.enum(["theory", "coding", "mixed", "timed", "review"]),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationSeconds: z.number().optional(),
  summary: z.object({
    questionsAttempted: z.number(),
    averageScore: z.number(),
    hintsUsed: z.number(),
  }),
});

export const listSessionsOutputModel = z.object({
  sessions: z.array(sessionItemModel),
});

export const getTotalTimeSpentOutputModel = z.object({
  totalSeconds: z.number(),
  totalAttempts: z.number(),
});
