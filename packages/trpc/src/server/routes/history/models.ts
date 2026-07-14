import { z } from "zod";

export const listAttemptsInputModel = z.object({
  topicIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(200).default(20),
  continuationToken: z.string().optional(),
});

const attemptSummaryModel = z.object({
  id: z.string(),
  questionId: z.string(),
  topicId: z.string(),
  attemptNumber: z.number(),
  testsPassed: z.number(),
  testsFailed: z.number(),
  totalTests: z.number(),
  pointsAwardedThisAttempt: z.number(),
  feedback: z.string(),
  strengths: z.array(z.string()),
  missingPoints: z.array(z.string()),
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
});

const testResultModel = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const getAttemptDetailOutputModel = z.object({
  id: z.string(),
  questionId: z.string(),
  topicId: z.string(),
  attemptNumber: z.number(),
  submittedCode: z.string(),
  testResults: z.array(testResultModel),
  testsPassed: z.number(),
  testsFailed: z.number(),
  totalTests: z.number(),
  feedback: z.object({
    text: z.string(),
    strengths: z.array(z.string()),
    missingPoints: z.array(z.string()),
    syntaxValid: z.boolean(),
    errorCategory: z.enum(["syntax", "logic", "runtime"]).nullable(),
  }),
  pointsAwardedThisAttempt: z.number(),
  // Enriched from questions collection
  questionText: z.string().optional(),
  modelAnswer: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  hints: z.array(z.string()).optional(),
  hintsUsedCount: z.number(),
  timeSpentSeconds: z.number(),
  createdAt: z.string(),
});
