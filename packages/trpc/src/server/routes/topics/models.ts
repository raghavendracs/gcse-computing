import { z } from "zod";

export const topicTreeOutputModel = z.array(
  z.object({
    area: z.string(),
    areaSortOrder: z.number(),
    topics: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        description: z.string(),
        totalQuestions: z.number(),
        solvedCount: z.number(),
      }),
    ),
  }),
);
