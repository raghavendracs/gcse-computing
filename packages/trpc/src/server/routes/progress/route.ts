import { Types } from "mongoose";
import { StudentProgress } from "@gcse/database";
import { studentProcedure, router } from "../../trpc";
import { getSummaryOutputModel, getModuleProgressInputModel, getModuleProgressOutputModel } from "./models";

export const progressRouter = router({
  getSummary: studentProcedure
    .output(getSummaryOutputModel)
    .query(async ({ ctx }) => {
      const doc = await StudentProgress.findOne({
        userId: new Types.ObjectId(ctx.user!.userId),
      });
      if (!doc) return null;

      return {
        streak: {
          currentDays: doc.streak.currentDays,
          lastActivityDate: doc.streak.lastActivityDate.toString(),
        },
        moduleProgress: doc.moduleProgress.map((m) => ({
          moduleId: m.moduleId.toString(),
          moduleName: m.moduleName,
          totalAttempts: m.totalAttempts,
          averageScore: m.averageScore,
          lastAttemptAt: m.lastAttemptAt.toString(),
          hintsPerQuestion: m.hintsPerQuestion,
          weakAreaFlags: m.weakAreaFlags,
        })),
        weakAreas: doc.weakAreas.map((w) => ({
          moduleId: w.moduleId.toString(),
          moduleName: w.moduleName,
          reasons: w.reasons,
          suggestedAction: w.suggestedAction,
        })),
        totalAttempts: doc.totalAttempts,
      };
    }),

  getModuleProgress: studentProcedure
    .input(getModuleProgressInputModel)
    .output(getModuleProgressOutputModel)
    .query(async ({ ctx, input }) => {
      const doc = await StudentProgress.findOne({
        userId: new Types.ObjectId(ctx.user!.userId),
      });
      if (!doc) return null;

      const entry = doc.moduleProgress.find(
        (m) => m.moduleId.toString() === input.moduleId,
      );
      if (!entry) return null;

      return {
        moduleId: entry.moduleId.toString(),
        moduleName: entry.moduleName,
        totalAttempts: entry.totalAttempts,
        averageScore: entry.averageScore,
        lastAttemptAt: entry.lastAttemptAt.toString(),
        hintsPerQuestion: entry.hintsPerQuestion,
        weakAreaFlags: entry.weakAreaFlags,
      };
    }),
});
