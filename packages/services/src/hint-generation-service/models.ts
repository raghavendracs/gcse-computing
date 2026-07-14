import { z } from "zod";

const testResultSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
});

export const generateHintInput = z.object({
  questionText: z.string(),
  submittedCode: z.string(),
  hintLevel: z.number().int().min(1).max(5),
  testResults: z.array(testResultSchema).optional(),
});

export type GenerateHintInput = z.infer<typeof generateHintInput>;

export const generateHintOutput = z.object({
  hintText: z.string(),
  hintLevel: z.number().int(),
  isLastHint: z.boolean(),
});

export type GenerateHintOutput = z.infer<typeof generateHintOutput>;
