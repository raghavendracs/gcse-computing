import { z } from "zod";

export const generateSeedQuestionInput = z.object({
  topicName: z.string(),
  topicDescription: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["write", "fix", "extend"]),
});
export type GenerateSeedQuestionInput = z.infer<typeof generateSeedQuestionInput>;

export const seedTestCase = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean(),
  description: z.string(),
});

export const generatedSeedQuestion = z.object({
  questionText: z.string(),
  starterCode: z.string().optional(),
  testCases: z.array(seedTestCase).min(4),
  hints: z.array(z.string()).min(1),
  modelAnswer: z.string(),
});
export type GeneratedSeedQuestion = z.infer<typeof generatedSeedQuestion>;
