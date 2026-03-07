import { z } from "zod";

export const markAnswerInput = z.object({
  questionText: z.string(),
  markSchemePoints: z.array(z.string()),
  submittedAnswer: z.string(),
  maxMarks: z.number().int().positive(),
});

export type MarkAnswerInput = z.infer<typeof markAnswerInput>;

export const markAnswerOutput = z.object({
  awardedMarks: z.number().int().min(0),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type MarkAnswerOutput = z.infer<typeof markAnswerOutput>;
