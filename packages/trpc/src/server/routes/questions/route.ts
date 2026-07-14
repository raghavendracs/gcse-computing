import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import {
  Question,
  QuestionAttempt,
  QuestionProgress,
  HintEvent,
  StudySession,
} from "@gcse/database";
import {
  CodeExecutionService,
  CodingAssessmentService,
  ScoringService,
  HintGenerationService,
} from "@gcse/services";
import { authenticatedProcedure, router } from "../../trpc";
import {
  getForTopicInputModel,
  getForTopicOutputModel,
  getByIdInputModel,
  getByIdOutputModel,
  runCodeInputModel,
  runCodeOutputModel,
  submitInputModel,
  submitOutputModel,
  requestCodingHintInputModel,
  requestCodingHintOutputModel,
} from "./models";

//#region  //*=========== Service singletons ===========

const codeExecSvc = new CodeExecutionService();
const codingAssessmentSvc = new CodingAssessmentService();
const scoringSvc = new ScoringService();
const hintGenSvc = new HintGenerationService();

//#endregion  //*======== Service singletons ===========

//#region  //*=========== Helpers ===========

/**
 * Build the testCasePreview for public question responses.
 * Non-hidden cases expose `input` + `description`; hidden cases are represented
 * as empty strings so the client knows the count but not the content.
 */
function buildTestCasePreview(testCases: { input: string; description: string; hidden: boolean }[]) {
  return testCases.map((tc) =>
    tc.hidden
      ? { input: "", description: "", hidden: true }
      : { input: tc.input, description: tc.description, hidden: false },
  );
}

//#endregion  //*======== Helpers ===========

export const questionsRouter = router({
  // ─── getForTopic ────────────────────────────────────────────────────────────
  getForTopic: authenticatedProcedure
    .input(getForTopicInputModel)
    .output(getForTopicOutputModel)
    .query(async ({ ctx, input }) => {
      const userId = new Types.ObjectId(ctx.user!.userId);
      const topicId = new Types.ObjectId(input.topicId);

      // Find question IDs the user has already solved for this topic
      const solvedProgress = await QuestionProgress.find(
        { userId, topicId, solved: true },
        { questionId: 1, _id: 0 },
      );
      const solvedIds = solvedProgress.map((p) => p.questionId);

      // Build query: same topic, not solved, not deleted
      const query: Record<string, unknown> = {
        topicId,
        deletedAt: null,
        _id: { $nin: solvedIds },
      };

      if (input.difficulty) {
        query.difficulty = input.difficulty;
      }

      const question = await Question.findOne(query);

      if (!question) return null;

      return {
        id: question._id.toString(),
        topicId: question.topicId.toString(),
        difficulty: question.difficulty,
        questionType: question.questionType,
        questionText: question.questionText,
        ...(question.starterCode ? { starterCode: question.starterCode } : {}),
        testCasePreview: buildTestCasePreview(question.testCases),
        points: question.points,
      };
    }),

  // ─── getById ────────────────────────────────────────────────────────────────
  getById: authenticatedProcedure
    .input(getByIdInputModel)
    .output(getByIdOutputModel)
    .query(async ({ ctx, input }) => {
      const question = await Question.findOne({
        _id: new Types.ObjectId(input.questionId),
        deletedAt: null,
      });

      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      return {
        id: question._id.toString(),
        topicId: question.topicId.toString(),
        difficulty: question.difficulty,
        questionType: question.questionType,
        questionText: question.questionText,
        ...(question.starterCode ? { starterCode: question.starterCode } : {}),
        testCasePreview: buildTestCasePreview(question.testCases),
        points: question.points,
      };
    }),

  // ─── runCode ─────────────────────────────────────────────────────────────────
  runCode: authenticatedProcedure
    .input(runCodeInputModel)
    .output(runCodeOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await Question.findOne({
        _id: new Types.ObjectId(input.questionId),
        deletedAt: null,
      });

      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const result = await codeExecSvc.execute({
        code: input.code,
        testCases: question.testCases,
        timeoutMs: 5000,
      });

      // Redact hidden test case content — show pass/fail only
      const redacted = result.testResults.map((r) =>
        r.hidden ? { ...r, expectedOutput: "", actualOutput: r.passed ? "" : "(hidden)" } : r,
      );

      return {
        ...result,
        testResults: redacted,
      };
    }),

  // ─── submit ──────────────────────────────────────────────────────────────────
  submit: authenticatedProcedure
    .input(submitInputModel)
    .output(submitOutputModel)
    .mutation(async ({ ctx, input }) => {
      const q = await Question.findOne({ _id: new Types.ObjectId(input.questionId), deletedAt: null });
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      // 1. Run test cases in sandbox
      const exec = await codeExecSvc.execute({ code: input.code, testCases: q.testCases, timeoutMs: 5000 });
      const testsPassed = exec.testResults.filter((r) => r.passed).length;
      const totalTests = exec.testResults.length;

      // 2. AI feedback (Haiku via assessCode)
      const ai = await codingAssessmentSvc.assessCode({
        questionText: q.questionText,
        submittedCode: input.code,
        testResults: exec.testResults,
        pointsAvailable: q.points,
      });

      // 3. Award-once scoring
      const score = await scoringSvc.applyAttempt({
        userId: ctx.user!.userId,
        questionId: q._id.toString(),
        topicId: q.topicId.toString(),
        difficulty: q.difficulty,
        testsPassed,
        totalTests,
      });

      // 4. Record the attempt
      const priorCount = await QuestionAttempt.countDocuments({
        questionId: q._id,
        userId: new Types.ObjectId(ctx.user!.userId),
        deletedAt: null,
      });

      const attempt = await QuestionAttempt.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: q._id,
        topicId: q.topicId,
        attemptNumber: priorCount + 1,
        submittedCode: input.code,
        testResults: exec.testResults,
        testsPassed,
        testsFailed: totalTests - testsPassed,
        totalTests,
        feedback: {
          text: ai.feedback,
          strengths: ai.strengths,
          missingPoints: ai.missingPoints,
          syntaxValid: ai.syntaxValid,
          errorCategory: ai.errorCategory,
        },
        pointsAwardedThisAttempt: score.delta,
        hintsUsedCount: input.hintsUsed,
        timeSpentSeconds: input.timeSpentSeconds,
      });

      // 5. Add question to session if sessionId provided
      if (input.sessionId) {
        await StudySession.updateOne(
          {
            _id: new Types.ObjectId(input.sessionId),
            userId: new Types.ObjectId(ctx.user!.userId),
            deletedAt: null,
          },
          { $addToSet: { questionIds: q._id } },
        );
      }

      // 6. Redact hidden test results before returning
      const redacted = exec.testResults.map((r) =>
        r.hidden ? { ...r, expectedOutput: "", actualOutput: r.passed ? "" : "(hidden)" } : r,
      );

      return {
        attemptId: attempt._id.toString(),
        testResults: redacted,
        testsPassed,
        testsFailed: totalTests - testsPassed,
        totalTests,
        feedback: {
          text: ai.feedback,
          strengths: ai.strengths,
          missingPoints: ai.missingPoints,
          syntaxValid: ai.syntaxValid,
          errorCategory: ai.errorCategory,
        },
        pointsAwarded: score.delta,
        newTotalPoints: score.newTotalPoints,
        solved: score.solved,
        modelAnswer: q.modelAnswer,
      };
    }),

  // ─── requestCodingHint ───────────────────────────────────────────────────────
  requestCodingHint: authenticatedProcedure
    .input(requestCodingHintInputModel)
    .output(requestCodingHintOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await Question.findOne({
        _id: new Types.ObjectId(input.questionId),
        deletedAt: null,
      });

      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const nextLevel = input.currentHintLevel + 1;
      if (nextLevel > 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No more hints available" });
      }

      const hint = await hintGenSvc.generateHint({
        questionText: question.questionText,
        submittedCode: input.code,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        testResults: input.testResults,
      });

      await HintEvent.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        topicId: question.topicId,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        hintText: hint.hintText,
        requestedAt: new Date(),
      });

      return hint;
    }),
});
