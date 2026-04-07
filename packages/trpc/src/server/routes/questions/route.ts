import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { GeneratedQuestion, HintEvent, Module, QuestionAttempt, StudySession } from "@gcse/database";
import { QuestionGenerationService, TheoryMarkingService, CodeExecutionService, CodingAssessmentService, HintGenerationService, ProgressService } from "@gcse/services";
import { studentProcedure, router } from "../../trpc";
import {
  generateQuestionInputModel,
  generatedQuestionOutputModel,
  generateQuestionSupportInputModel,
  generateQuestionSupportOutputModel,
  submitAnswerInputModel,
  submitAnswerOutputModel,
  requestHintInputModel,
  requestHintOutputModel,
  runCodeInputModel,
  runCodeOutputModel,
  requestCodingHintInputModel,
  requestCodingHintOutputModel,
} from "./models";

const questionGenSvc = new QuestionGenerationService();
const markingSvc = new TheoryMarkingService();
const codeExecSvc = new CodeExecutionService();
const codingAssessmentSvc = new CodingAssessmentService();
const hintGenSvc = new HintGenerationService();
const progressSvc = new ProgressService();

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
        mode: input.mode,
      });
    }),

  generateQuestionSupport: studentProcedure
    .input(generateQuestionSupportInputModel)
    .output(generateQuestionSupportOutputModel)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership before generating support
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      return questionGenSvc.generateQuestionSupport(input.questionId);
    }),

  submitAnswer: studentProcedure
    .input(submitAnswerInputModel)
    .output(submitAnswerOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const priorCount = await QuestionAttempt.countDocuments({
        $and: [
          { questionId: question._id },
          { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
        ],
      });

      let assessmentResult: {
        awardedMarks: number;
        maxMarks: number;
        feedback: string;
        missingPoints: string[];
        strengths: string[];
        confidence: number;
      };
      let codingAnalysis: {
        syntaxValid: boolean;
        testsPassed: number;
        testsFailed: number;
        errorCategory: "syntax" | "logic" | "runtime" | null;
        executionPath: "sandbox" | "ai";
      } | undefined;

      if (question.answerFormat === "code") {
        const execResult = await codeExecSvc.execute({
          code: input.answer,
          testCases: question.testCases,
          timeoutMs: 5000,
        });

        const modelId = await questionGenSvc.resolveModelForUser(ctx.user!.userId);
        const aiAssessment = await codingAssessmentSvc.assessCode({
          questionText: question.questionText,
          submittedCode: input.answer,
          testResults: execResult.testResults,
          markSchemePoints: question.markSchemePoints,
          maxMarks: question.maxMarks,
          modelId,
        });

        assessmentResult = {
          awardedMarks: aiAssessment.awardedMarks,
          maxMarks: question.maxMarks,
          feedback: aiAssessment.feedback,
          missingPoints: aiAssessment.missingPoints,
          strengths: aiAssessment.strengths,
          confidence: aiAssessment.confidence,
        };
        codingAnalysis = {
          syntaxValid: aiAssessment.syntaxValid,
          testsPassed: execResult.testResults.filter((r) => r.passed).length,
          testsFailed: execResult.testResults.filter((r) => !r.passed).length,
          errorCategory: aiAssessment.errorCategory,
          executionPath: execResult.executionPath,
        };
      } else {
        const marking = await markingSvc.markAnswer({
          questionText: question.questionText,
          markSchemePoints: question.markSchemePoints,
          submittedAnswer: input.answer,
          maxMarks: question.maxMarks,
        });
        assessmentResult = {
          awardedMarks: marking.awardedMarks,
          maxMarks: question.maxMarks,
          feedback: marking.feedback,
          missingPoints: marking.missingPoints,
          strengths: marking.strengths,
          confidence: marking.confidence,
        };
      }

      const attempt = await QuestionAttempt.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        attemptNumber: priorCount + 1,
        submittedAnswer: input.answer,
        submissionType: question.answerFormat === "code" ? "code" : "text",
        assessment: assessmentResult,
        codingAnalysis,
        hintsUsedCount: input.hintsUsed,
        timeSpentSeconds: input.timeSpentSeconds,
      });

      await GeneratedQuestion.updateOne(
        { _id: question._id },
        { $set: { usedInSession: true } },
      );

      // Fetch module name for progress tracking
      const mod = await Module.findOne({ _id: question.moduleId });

      // Update student progress (fire-and-forget — don't block response)
      if (mod) {
        progressSvc.updateAfterAttempt({
          userId: ctx.user!.userId,
          moduleId: question.moduleId.toString(),
          moduleName: mod.moduleName,
          awardedMarks: assessmentResult.awardedMarks,
          maxMarks: assessmentResult.maxMarks,
          hintsUsed: input.hintsUsed,
          submissionType: question.answerFormat === "code" ? "code" : "text",
          hadError: codingAnalysis?.errorCategory != null,
        }).catch(() => { /* non-blocking */ });
      }

      // Spaced repetition: retire correctly-answered questions for 7 days
      if (assessmentResult.awardedMarks === assessmentResult.maxMarks) {
        const reviewAt = new Date();
        reviewAt.setDate(reviewAt.getDate() + 7);
        await GeneratedQuestion.updateOne(
          { _id: question._id },
          { $set: { nextReviewAt: reviewAt } },
        );
      }

      if (input.sessionId) {
        await StudySession.updateOne(
          {
            $and: [
              { _id: new Types.ObjectId(input.sessionId) },
              { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
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
          { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
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

  runCode: studentProcedure
    .input(runCodeInputModel)
    .output(runCodeOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const result = await codeExecSvc.execute({
        code: input.code,
        testCases: question.testCases,
        timeoutMs: 5000,
      });

      return {
        ...result,
        testResults: result.testResults.map((r) =>
          r.hidden
            ? { ...r, expectedOutput: "", actualOutput: r.passed ? "" : "(hidden)" }
            : r,
        ),
      };
    }),

  requestCodingHint: studentProcedure
    .input(requestCodingHintInputModel)
    .output(requestCodingHintOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId), deletedAt: null },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const nextLevel = input.currentHintLevel + 1;
      if (nextLevel > 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No more hints available" });
      }

      const modelId = await questionGenSvc.resolveModelForUser(ctx.user!.userId);

      const hint = await hintGenSvc.generateHint({
        questionText: question.questionText,
        submittedCode: input.code,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        testResults: input.testResults,
        modelId,
      });

      await HintEvent.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        hintText: hint.hintText,
        requestedAt: new Date(),
      });

      return hint;
    }),
});
