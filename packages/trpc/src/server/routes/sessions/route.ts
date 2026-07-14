import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { QuestionAttempt, StudySession } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import {
  startSessionInputModel,
  startSessionOutputModel,
  endSessionInputModel,
  endSessionOutputModel,
  listSessionsInputModel,
  listSessionsOutputModel,
  getTotalTimeSpentOutputModel,
} from "./models";

export const sessionsRouter = router({
  startSession: authenticatedProcedure
    .input(startSessionInputModel)
    .output(startSessionOutputModel)
    .mutation(async ({ ctx, input }) => {
      const session = await StudySession.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        mode: input.mode,
        startedAt: new Date(),
        questionIds: [],
        summary: { questionsAttempted: 0, averageScore: 0, hintsUsed: 0 },
      } as any);
      return { sessionId: session._id.toString() };
    }),

  endSession: authenticatedProcedure
    .input(endSessionInputModel)
    .output(endSessionOutputModel)
    .mutation(async ({ ctx, input }) => {
      const session = await StudySession.findOne({
        $and: [
          { _id: new Types.ObjectId(input.sessionId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
          { deletedAt: null },
        ],
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });

      const attempts = await QuestionAttempt.find({
        $and: [
          { userId: new Types.ObjectId(ctx.user!.userId) },
          { questionId: { $in: session.questionIds } },
          { deletedAt: null },
        ],
      });

      const questionsAttempted = session.questionIds.length;
      const averageScore =
        attempts.length > 0
          ? attempts.reduce(
              (sum, a) => sum + (a.totalTests > 0 ? a.testsPassed / a.totalTests : 0),
              0,
            ) / attempts.length
          : 0;
      const hintsUsed = attempts.reduce((sum, a) => sum + (a.hintsUsedCount ?? 0), 0);
      const endedAt = new Date();

      await StudySession.findOneAndUpdate(
        { _id: session._id },
        { $set: { endedAt, summary: { questionsAttempted, averageScore, hintsUsed } } },
      );

      return { success: true, summary: { questionsAttempted, averageScore, hintsUsed } };
    }),

  listSessions: authenticatedProcedure
    .input(listSessionsInputModel)
    .output(listSessionsOutputModel)
    .query(async ({ ctx, input }) => {
      const sessions = await StudySession.find({
        userId: new Types.ObjectId(ctx.user!.userId),
        deletedAt: null,
      })
        .sort({ startedAt: -1 })
        .limit(input?.limit ?? 20);

      return {
        sessions: sessions.map((s) => ({
          id: s._id.toString(),
          mode: s.mode,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt?.toISOString(),
          durationSeconds: s.endedAt
            ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
            : undefined,
          summary: s.summary,
        })),
      };
    }),

  getTotalTimeSpent: authenticatedProcedure
    .output(getTotalTimeSpentOutputModel)
    .query(async ({ ctx }) => {
      const attempts = await QuestionAttempt.find({
        userId: new Types.ObjectId(ctx.user!.userId),
        deletedAt: null,
      }).select("timeSpentSeconds");
      const totalSeconds = attempts.reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0);
      return { totalSeconds, totalAttempts: attempts.length };
    }),
});
