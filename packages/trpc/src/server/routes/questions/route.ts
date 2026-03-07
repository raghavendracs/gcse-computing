import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { GeneratedQuestion, HintEvent, QuestionAttempt, StudySession } from "@gcse/database";
import { QuestionGenerationService, TheoryMarkingService } from "@gcse/services";
import { studentProcedure, router } from "../../trpc";
import {
  generateQuestionInputModel,
  generatedQuestionOutputModel,
  submitAnswerInputModel,
  submitAnswerOutputModel,
  requestHintInputModel,
  requestHintOutputModel,
} from "./models";

const questionGenSvc = new QuestionGenerationService();
const markingSvc = new TheoryMarkingService();

export const questionsRouter = router({
  generateQuestion: studentProcedure
    .input(generateQuestionInputModel)
    .output(generatedQuestionOutputModel)
    .mutation(async ({ ctx, input }) => {
      return questionGenSvc.generateQuestion({
        moduleId: input.moduleId,
        userId: ctx.user!.userId,
        difficulty: input.difficulty,
        examBoard: input.examBoard,
      });
    }),

  submitAnswer: studentProcedure
    .input(submitAnswerInputModel)
    .output(submitAnswerOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      // Count prior attempts for attempt number
      const priorCount = await QuestionAttempt.countDocuments({
        $and: [
          { questionId: question._id },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });

      // Mark the answer
      const assessment = await markingSvc.markAnswer({
        questionText: question.questionText,
        markSchemePoints: question.markSchemePoints,
        submittedAnswer: input.answer,
        maxMarks: question.maxMarks,
      });

      const assessmentResult = {
        awardedMarks: assessment.awardedMarks,
        maxMarks: question.maxMarks,
        feedback: assessment.feedback,
        missingPoints: assessment.missingPoints,
        strengths: assessment.strengths,
        confidence: assessment.confidence,
      };

      // Store attempt
      const attempt = await QuestionAttempt.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        attemptNumber: priorCount + 1,
        submittedAnswer: input.answer,
        submissionType: "text",
        assessment: assessmentResult,
        hintsUsedCount: input.hintsUsed,
        timeSpentSeconds: input.timeSpentSeconds,
      });

      // Mark question as used only after attempt is safely written
      await GeneratedQuestion.updateOne(
        { _id: question._id },
        { $set: { usedInSession: true } },
      );

      // Add question to session if sessionId provided
      if (input.sessionId) {
        await StudySession.updateOne(
          {
            $and: [
              { _id: new Types.ObjectId(input.sessionId) },
              { userId: new Types.ObjectId(ctx.user!.userId) },
            ],
          },
          { $addToSet: { questionIds: question._id } },
        );
      }

      return {
        attemptId: attempt._id.toString(),
        assessment: assessmentResult,
        modelAnswer: question.modelAnswer,
        markSchemePoints: question.markSchemePoints,
      };
    }),

  requestHint: studentProcedure
    .input(requestHintInputModel)
    .output(requestHintOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const nextLevel = input.currentHintLevel + 1;
      if (nextLevel > question.hints.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No more hints available" });
      }

      const hintText = question.hints[nextLevel - 1];
      if (!hintText) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Hint data missing for this question" });
      }

      await HintEvent.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        hintText,
        requestedAt: new Date(),
      });

      return { hintText, hintLevel: nextLevel, isLastHint: nextLevel === 5 };
    }),
});
