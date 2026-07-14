import { ProgrammingTopic, Question, QuestionProgress } from "@gcse/database";
import { Types } from "mongoose";
import { authenticatedProcedure, router } from "../../trpc";
import { topicTreeOutputModel } from "./models";

export const topicsRouter = router({
  getTree: authenticatedProcedure
    .output(topicTreeOutputModel)
    .query(async ({ ctx }) => {
      const userId = new Types.ObjectId(ctx.user!.userId);
      const topics = await ProgrammingTopic.find({ deletedAt: null }).sort({ areaSortOrder: 1, sortOrder: 1 });

      const counts = await Question.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$topicId", n: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((c: any) => [c._id.toString(), c.n]));

      const solved = await QuestionProgress.aggregate([
        { $match: { userId, solved: true } },
        { $group: { _id: "$topicId", n: { $sum: 1 } } },
      ]);
      const solvedMap = new Map(solved.map((c: any) => [c._id.toString(), c.n]));

      const byArea = new Map<string, { area: string; areaSortOrder: number; topics: any[] }>();
      for (const t of topics) {
        const key = t.area;
        if (!byArea.has(key)) byArea.set(key, { area: t.area, areaSortOrder: t.areaSortOrder, topics: [] });
        byArea.get(key)!.topics.push({
          id: t._id.toString(),
          name: t.name,
          slug: t.slug,
          description: t.description,
          totalQuestions: countMap.get(t._id.toString()) ?? 0,
          solvedCount: solvedMap.get(t._id.toString()) ?? 0,
        });
      }
      return Array.from(byArea.values()).sort((a, b) => a.areaSortOrder - b.areaSortOrder);
    }),
});
