import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { QuestionAttempt, Question } from "@gcse/database";
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
      const conditions: object[] = [
        { userId: new Types.ObjectId(ctx.user!.userId) },
        { deletedAt: null },
      ];

      if (input.topicIds && input.topicIds.length > 0) {
        conditions.push({ topicId: { $in: input.topicIds.map((id) => new Types.ObjectId(id)) } });
      }

      if (input.continuationToken) {
        conditions.push({ _id: { $lt: new Types.ObjectId(input.continuationToken) } });
      }

      const attempts = await QuestionAttempt.find({ $and: conditions })
        .sort({ _id: -1 })
        .limit(input.limit + 1);

      const hasMore = attempts.length > input.limit;
      const toReturn = hasMore ? attempts.slice(0, input.limit) : attempts;
      const nextToken = hasMore ? toReturn[toReturn.length - 1]._id.toString() : null;

      return {
        attempts: toReturn.map((a) => ({
          id: a._id.toString(),
          questionId: a.questionId.toString(),
          topicId: a.topicId.toString(),
          attemptNumber: a.attemptNumber,
          testsPassed: a.testsPassed,
          testsFailed: a.testsFailed,
          totalTests: a.totalTests,
          pointsAwardedThisAttempt: a.pointsAwardedThisAttempt,
          feedback: a.feedback.text,
          strengths: a.feedback.strengths,
          missingPoints: a.feedback.missingPoints,
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
          { deletedAt: null },
        ],
      });
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });

      const question = await Question.findOne({ _id: attempt.questionId });

      return {
        id: attempt._id.toString(),
        questionId: attempt.questionId.toString(),
        topicId: attempt.topicId.toString(),
        attemptNumber: attempt.attemptNumber,
        submittedCode: attempt.submittedCode,
        testResults: attempt.testResults.map((r) =>
          r.hidden
            ? { input: r.input, expectedOutput: "", actualOutput: r.passed ? "" : "(hidden)", passed: r.passed, hidden: r.hidden }
            : { input: r.input, expectedOutput: r.expectedOutput, actualOutput: r.actualOutput, passed: r.passed, hidden: r.hidden }
        ),
        testsPassed: attempt.testsPassed,
        testsFailed: attempt.testsFailed,
        totalTests: attempt.totalTests,
        feedback: {
          text: attempt.feedback.text,
          strengths: attempt.feedback.strengths,
          missingPoints: attempt.feedback.missingPoints,
          syntaxValid: attempt.feedback.syntaxValid,
          errorCategory: attempt.feedback.errorCategory,
        },
        pointsAwardedThisAttempt: attempt.pointsAwardedThisAttempt,
        questionText: question?.questionText,
        modelAnswer: question?.modelAnswer,
        difficulty: question?.difficulty,
        hints: question?.hints,
        hintsUsedCount: attempt.hintsUsedCount,
        timeSpentSeconds: attempt.timeSpentSeconds,
        createdAt: attempt.createdAt.toString(),
      };
    }),
});
