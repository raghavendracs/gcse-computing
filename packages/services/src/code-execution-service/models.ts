import { z } from "zod";

export const testCaseInput = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean(),
});

export const executeInput = z.object({
  code: z.string(),
  testCases: z.array(testCaseInput),
  timeoutMs: z.number().int().positive().optional().default(5000),
});

export type ExecuteInput = z.input<typeof executeInput>;

export const testResultOutput = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const executeOutput = z.object({
  testResults: z.array(testResultOutput),
  stderr: z.string(),
  executionTimeMs: z.number(),
  timedOut: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  executionPath: z.enum(["sandbox", "ai"]),
});

export type ExecuteOutput = z.infer<typeof executeOutput>;
