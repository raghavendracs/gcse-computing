import { z } from "zod";

export const updateProgressPayload = z.object({
  userId: z.string(),
  moduleId: z.string(),
  moduleName: z.string(),
  awardedMarks: z.number(),
  maxMarks: z.number(),
  hintsUsed: z.number(),
  submissionType: z.enum(["text", "code"]),
  hadError: z.boolean(),
});

export type UpdateProgressPayload = z.infer<typeof updateProgressPayload>;
