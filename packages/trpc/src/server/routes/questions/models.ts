import { z } from "zod";

export const generateQuestionInputModel = z.object({
  moduleId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  mode: z.enum(["theory", "coding"]).optional(),
});

const testCaseModel = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean(),
});

export const generatedQuestionOutputModel = z.object({
  id: z.string(),
  moduleId: z.string(),
  questionType: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionText: z.string(),
  answerFormat: z.enum(["free_text", "code", "multiple_choice"]),
  maxMarks: z.number(),
  modelAnswer: z.string(),
  hints: z.array(z.string()),
  testCases: z.array(testCaseModel),
  metadata: z.object({
    examBoard: z.string(),
    topicName: z.string(),
    misconceptionNotes: z.array(z.string()),
  }),
});

export const submitAnswerInputModel = z.object({
  questionId: z.string(),
  sessionId: z.string().optional(),
  answer: z.string().min(1, "Answer cannot be empty"),
  hintsUsed: z.number().int().min(0).default(0),
  timeSpentSeconds: z.number().int().min(0).default(0),
});

const assessmentModel = z.object({
  awardedMarks: z.number(),
  maxMarks: z.number(),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  confidence: z.number(),
});

export const submitAnswerOutputModel = z.object({
  attemptId: z.string(),
  assessment: assessmentModel,
  modelAnswer: z.string(),
  markSchemePoints: z.array(z.string()),
});

export const requestHintInputModel = z.object({
  questionId: z.string(),
  currentHintLevel: z.number().int().min(0).max(4),
});

export const requestHintOutputModel = z.object({
  hintText: z.string(),
  hintLevel: z.number(),
  isLastHint: z.boolean(),
});

export const runCodeInputModel = z.object({
  questionId: z.string(),
  code: z.string(),
});

const testResultModel = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const runCodeOutputModel = z.object({
  testResults: z.array(testResultModel),
  stderr: z.string(),
  executionTimeMs: z.number(),
  timedOut: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  executionPath: z.enum(["sandbox", "ai"]),
});

export const requestCodingHintInputModel = z.object({
  questionId: z.string(),
  code: z.string(),
  currentHintLevel: z.number().int().min(0).max(4),
  testResults: z.array(testResultModel).optional(),
});

export const requestCodingHintOutputModel = z.object({
  hintText: z.string(),
  hintLevel: z.number(),
  isLastHint: z.boolean(),
});
