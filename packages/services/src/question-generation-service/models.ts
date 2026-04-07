import { z } from "zod";

export const generateQuestionInput = z.object({
  moduleId: z.string(),
  userId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  mode: z.enum(["theory", "coding"]).optional(),
});

// Use z.input to get the type before defaults are applied (difficulty is optional)
export type GenerateQuestionInput = z.input<typeof generateQuestionInput>;

export const generatedQuestionOutput = z.object({
  id: z.string(),
  moduleId: z.string(),
  questionType: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionText: z.string(),
  answerFormat: z.enum(["free_text", "code", "multiple_choice"]),
  maxMarks: z.number(),
  markSchemePoints: z.array(z.string()),
  modelAnswer: z.string(),
  hints: z.array(z.string()),
  testCases: z.array(
    z.object({ input: z.string(), expectedOutput: z.string(), hidden: z.boolean() }),
  ),
  supportReady: z.boolean(),
  metadata: z.object({
    examBoard: z.string(),
    topicName: z.string(),
    misconceptionNotes: z.array(z.string()),
  }),
});

export type GeneratedQuestionOutput = z.infer<typeof generatedQuestionOutput>;
