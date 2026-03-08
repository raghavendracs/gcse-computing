import { z } from "zod";

export const getByExamBoardInputModel = z.object({
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]),
});

const specTopicModel = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  paper: z.enum(["01", "02"]),
  topicGroup: z.string(),
  topicGroupTitle: z.string(),
  sortOrder: z.number(),
  moduleIds: z.array(z.string()),
});

export const getByExamBoardOutputModel = z.array(specTopicModel);
