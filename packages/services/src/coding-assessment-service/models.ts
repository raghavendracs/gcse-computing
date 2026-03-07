import { z } from "zod";

const testResultSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const assessCodeInput = z.object({
  questionText: z.string(),
  submittedCode: z.string(),
  testResults: z.array(testResultSchema),
  markSchemePoints: z.array(z.string()),
  maxMarks: z.number().int().positive(),
  modelId: z.string(),
});

export type AssessCodeInput = z.infer<typeof assessCodeInput>;

export const assessCodeOutput = z.object({
  awardedMarks: z.number().int().min(0),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  syntaxValid: z.boolean(),
  errorCategory: z.enum(["syntax", "logic", "runtime"]).nullable(),
});

export type AssessCodeOutput = z.infer<typeof assessCodeOutput>;
