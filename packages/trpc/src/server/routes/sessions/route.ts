import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { QuestionAttempt, StudySession } from "@gcse/database";
import { studentProcedure, router } from "../../trpc";
import {
  startSessionInputModel,
  startSessionOutputModel,
  endSessionInputModel,
  endSessionOutputModel,
} from "./models";

export const sessionsRouter = router({
  startSession: studentProcedure
    .input(startSessionInputModel)
    .output(startSessionOutputModel)
    .mutation(async ({ ctx, input }) => {
      const session = await StudySession.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        moduleId: new Types.ObjectId(input.moduleId),
        mode: input.mode,
        startedAt: new Date(),
        questionIds: [],
        summary: { questionsAttempted: 0, averageScore: 0, hintsUsed: 0 },
      });
      return { sessionId: session._id.toString() };
    }),

  endSession: studentProcedure
    .input(endSessionInputModel)
    .output(endSessionOutputModel)
    .mutation(async ({ ctx, input }) => {
      const session = await StudySession.findOne({
        $and: [
          { _id: new Types.ObjectId(input.sessionId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });

      const attempts = await QuestionAttempt.find({
        $and: [
          { userId: new Types.ObjectId(ctx.user!.userId) },
          { questionId: { $in: session.questionIds } },
        ],
      });

      const questionsAttempted = session.questionIds.length;
      const totalScore = attempts.reduce((sum, a) => sum + a.assessment.awardedMarks, 0);
      const totalMaxScore = attempts.reduce((sum, a) => sum + a.assessment.maxMarks, 0);
      const averageScore = totalMaxScore > 0 ? totalScore / totalMaxScore : 0;
      const hintsUsed = attempts.reduce((sum, a) => sum + a.hintsUsedCount, 0);

      await StudySession.findOneAndUpdate(
        { _id: session._id },
        { $set: { endedAt: new Date(), summary: { questionsAttempted, averageScore, hintsUsed } } },
      );

      return { success: true, summary: { questionsAttempted, averageScore, hintsUsed } };
    }),
});
