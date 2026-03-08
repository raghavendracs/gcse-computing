import { z } from "zod";

export const listAttemptsInputModel = z.object({
  moduleId: z.string().optional(),
  moduleIds: z.array(z.string()).optional(),
  studentId: z.string().optional(), // parent can pass a student's id to view their history
  limit: z.number().int().min(1).max(200).default(20),
  continuationToken: z.string().optional(),
});

const attemptSummaryModel = z.object({
  id: z.string(),
  questionId: z.string(),
  moduleId: z.string(),
  attemptNumber: z.number(),
  submissionType: z.enum(["text", "code"]),
  awardedMarks: z.number(),
  maxMarks: z.number(),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  hintsUsedCount: z.number(),
  timeSpentSeconds: z.number(),
  createdAt: z.string(),
});

export const listAttemptsOutputModel = z.object({
  attempts: z.array(attemptSummaryModel),
  hasMore: z.boolean(),
  continuationToken: z.string().nullable(),
});

export const getAttemptDetailInputModel = z.object({
  attemptId: z.string(),
  studentId: z.string().optional(), // parent can pass student's id
});

export const getAttemptDetailOutputModel = z.object({
  id: z.string(),
  questionId: z.string(),
  moduleId: z.string(),
  attemptNumber: z.number(),
  submittedAnswer: z.string(),
  submissionType: z.enum(["text", "code"]),
  assessment: z.object({
    awardedMarks: z.number(),
    maxMarks: z.number(),
    feedback: z.string(),
    missingPoints: z.array(z.string()),
    strengths: z.array(z.string()),
    confidence: z.number(),
  }),
  // Enriched from generated_questions
  questionText: z.string().optional(),
  modelAnswer: z.string().optional(),
  markSchemePoints: z.array(z.string()).optional(),
  hints: z.array(z.string()).optional(),
  hintsUsedCount: z.number(),
  timeSpentSeconds: z.number(),
  createdAt: z.string(),
});
