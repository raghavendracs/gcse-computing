import { z } from "zod";

// A cached evaluation case for a question: an AI-generated input paired with the
// reference (model answer) output — used as supporting execution evidence.
export const evalCase = z.object({
  input: z.string(),
  referenceOutput: z.string(),
  kind: z.enum(["normal", "edge"]),
  hidden: z.boolean(),
});
export type EvalCase = z.infer<typeof evalCase>;

// The result of running the student's code against one eval case (evidence only).
export const evalCaseResult = z.object({
  input: z.string(),
  referenceOutput: z.string(),
  studentOutput: z.string(),
  matched: z.boolean(),
  kind: z.enum(["normal", "edge"]),
  hidden: z.boolean(),
});
export type EvalCaseResult = z.infer<typeof evalCaseResult>;

// One entry of the LLM input-generation response.
export const generatedInput = z.object({
  input: z.string(),
  kind: z.enum(["normal", "edge"]),
});
export type GeneratedInput = z.infer<typeof generatedInput>;

// ── Logical gap analysis (surfaced to the student) ────────────────────────────
// severity intentionally has NO "style": naming, prompts, extra output text and
// formatting are never gaps. Only genuine logic/flow/correctness issues.
export const gapSeverity = z.enum(["logic", "edge_case", "requirement"]);

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

// ── LLM correctness verdict (the grader) ──────────────────────────────────────
// The judge decides correctness on LOGIC AND FLOW, tolerating superficial
// differences (prompts, variable names, extra output text, formatting).
export const judgeOutput = z.object({
  correct: z.boolean(),
  correctnessScore: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(gap),
  likelyComplete: z.boolean().nullable(),
});
export type JudgeOutput = z.infer<typeof judgeOutput>;

export interface EvaluateResult {
  correct: boolean;
  correctnessScore: number;
  results: EvalCaseResult[];
  analysis: GapAnalysis;
}
