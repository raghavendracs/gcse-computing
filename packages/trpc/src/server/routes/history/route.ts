import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { QuestionAttempt, GeneratedQuestion } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import {
  listAttemptsInputModel,
  listAttemptsOutputModel,
  getAttemptDetailInputModel,
  getAttemptDetailOutputModel,
} from "./models";

export const historyRouter = router({
  listAttempts: authenticatedProcedure
    .input(listAttemptsInputModel)
    .output(listAttemptsOutputModel)
    .query(async ({ ctx, input }) => {
      const conditions: object[] = [{ userId: new Types.ObjectId(ctx.user!.userId) }];

      if (input.moduleId) {
        conditions.push({ moduleId: new Types.ObjectId(input.moduleId) });
      }
      if (input.continuationToken) {
        conditions.push({ _id: { $lt: new Types.ObjectId(input.continuationToken) } });
      }

      const attempts = await QuestionAttempt.find({ $and: conditions })
        .sort({ createdAt: -1 })
        .limit(input.limit + 1);

      const hasMore = attempts.length > input.limit;
      const toReturn = hasMore ? attempts.slice(0, input.limit) : attempts;
      const nextToken = hasMore ? toReturn[toReturn.length - 1]._id.toString() : null;

      return {
        attempts: toReturn.map((a) => ({
          id: a._id.toString(),
          questionId: a.questionId.toString(),
          moduleId: a.moduleId.toString(),
          attemptNumber: a.attemptNumber,
          submissionType: a.submissionType,
          awardedMarks: a.assessment.awardedMarks,
          maxMarks: a.assessment.maxMarks,
          feedback: a.assessment.feedback,
          missingPoints: a.assessment.missingPoints,
          strengths: a.assessment.strengths,
          hintsUsedCount: a.hintsUsedCount,
          timeSpentSeconds: a.timeSpentSeconds,
          createdAt: a.createdAt.toString(),
        })),
        hasMore,
        continuationToken: nextToken,
      };
    }),

  getAttemptDetail: authenticatedProcedure
    .input(getAttemptDetailInputModel)
    .output(getAttemptDetailOutputModel)
    .query(async ({ ctx, input }) => {
      const attempt = await QuestionAttempt.findOne({
        $and: [
          { _id: new Types.ObjectId(input.attemptId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });

      // Fetch question for enriched context
      const question = await GeneratedQuestion.findOne({ _id: attempt.questionId });

      return {
        id: attempt._id.toString(),
        questionId: attempt.questionId.toString(),
        moduleId: attempt.moduleId.toString(),
        attemptNumber: attempt.attemptNumber,
        submittedAnswer: attempt.submittedAnswer,
        submissionType: attempt.submissionType,
        assessment: {
          awardedMarks: attempt.assessment.awardedMarks,
          maxMarks: attempt.assessment.maxMarks,
          feedback: attempt.assessment.feedback,
          missingPoints: attempt.assessment.missingPoints,
          strengths: attempt.assessment.strengths,
          confidence: attempt.assessment.confidence,
        },
        questionText: question?.questionText,
        modelAnswer: question?.modelAnswer,
        markSchemePoints: question?.markSchemePoints,
        hints: question?.hints,
        hintsUsedCount: attempt.hintsUsedCount,
        timeSpentSeconds: attempt.timeSpentSeconds,
        createdAt: attempt.createdAt.toString(),
      };
    }),
});
