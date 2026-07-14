import { z } from "zod";

// EvalCase schema and type
export const evalCase = z.object({
  input: z.string(),
  referenceOutput: z.string(),
  kind: z.enum(["normal", "edge"]),
  hidden: z.boolean(),
});

export type EvalCase = z.infer<typeof evalCase>;

// EvalCaseResult schema and type
export const evalCaseResult = z.object({
  input: z.string(),
  referenceOutput: z.string(),
  studentOutput: z.string(),
  matched: z.boolean(),
  kind: z.enum(["normal", "edge"]),
  hidden: z.boolean(),
});

export type EvalCaseResult = z.infer<typeof evalCaseResult>;

// generatedInput schema and type (used to validate LLM generation response)
export const generatedInput = z.object({
  input: z.string(),
  kind: z.enum(["normal", "edge"]),
});

export type GeneratedInput = z.infer<typeof generatedInput>;

// ── Logical gap analysis ──────────────────────────────────────────────────────
export const gapSeverity = z.enum(["logic", "edge_case", "requirement", "style"]);

export const gap = z.object({
  title: z.string(),
  detail: z.string(),
  severity: gapSeverity,
});
export type Gap = z.infer<typeof gap>;

export const gapAnalysisOutput = z.object({
  summary: z.string(),
  matched: z.array(z.string()),
  gaps: z.array(gap),
  likelyComplete: z.boolean().nullable(),
});
export type GapAnalysis = z.infer<typeof gapAnalysisOutput>;
