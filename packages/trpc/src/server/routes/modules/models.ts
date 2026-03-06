import { z } from "zod";

export const moduleOutputModel = z.object({
  id: z.string(),
  examBoard: z.enum(["OCR", "AQA", "Edexcel", "generic"]),
  moduleCode: z.string(),
  moduleName: z.string(),
  topicName: z.string(),
  topicType: z.enum(["theory", "programming", "mixed"]),
  description: z.string(),
  specReferences: z.array(z.string()),
  difficultyBands: z.array(z.enum(["easy", "medium", "hard"])),
  sortOrder: z.number(),
});

export const listModulesInputModel = z.object({
  examBoard: z.enum(["OCR", "AQA", "Edexcel", "generic"]).optional(),
  topicType: z.enum(["theory", "programming", "mixed"]).optional(),
});
