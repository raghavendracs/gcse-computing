import { z } from "zod";

// ─── Shared primitives ────────────────────────────────────────────────────────

/** Full test result shape returned by the sandbox (and stored in QuestionAttempt). */
export const testResultModel = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export type TestResult = z.infer<typeof testResultModel>;

// ─── Public question shape (no expectedOutput, no modelAnswer) ────────────────

export const publicQuestionModel = z.object({
  id: z.string(),
  topicId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["write", "fix", "extend"]),
  questionText: z.string(),
  starterCode: z.string().optional(),
  /** Non-hidden cases expose input+description; hidden cases expose only the count (input/description = ""). */
  testCasePreview: z.array(
    z.object({
      input: z.string(),
      description: z.string(),
      hidden: z.boolean(),
    }),
  ),
  points: z.number(),
});

// ─── getForTopic ──────────────────────────────────────────────────────────────

export const getForTopicInputModel = z.object({
  topicId: z.string().describe("ID of the programming topic"),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("Optional difficulty filter"),
  excludeQuestionId: z
    .string()
    .optional()
    .describe("Question to skip past — never returned (used by the Skip button)"),
});

export const getForTopicOutputModel = publicQuestionModel.nullable();

// ─── listForTopic (all questions in a section with the user's status) ─────────

export const listForTopicInputModel = z.object({
  topicId: z.string().describe("ID of the programming topic"),
});

export const questionListItemModel = z.object({
  id: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["write", "fix", "extend"]),
  points: z.number(),
  preview: z.string().describe("Short excerpt of the question text (no answers)"),
  status: z.enum(["not_attempted", "attempted", "solved"]),
  bestPointsAwarded: z.number(),
  attemptsCount: z.number(),
});

export const listForTopicOutputModel = z.array(questionListItemModel);

// ─── getById ─────────────────────────────────────────────────────────────────

export const getByIdInputModel = z.object({
  questionId: z.string().describe("ID of the question"),
});

export const getByIdOutputModel = publicQuestionModel;

// ─── runCode ─────────────────────────────────────────────────────────────────

export const runCodeInputModel = z.object({
  questionId: z.string().describe("ID of the question"),
  code: z.string().describe("Python code to execute"),
});

export const runCodeOutputModel = z.object({
  testResults: z.array(testResultModel),
  stderr: z.string(),
  executionTimeMs: z.number(),
  timedOut: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  executionPath: z.enum(["sandbox", "ai"]),
});

// ─── submit ───────────────────────────────────────────────────────────────────

export const submitInputModel = z.object({
  questionId: z.string().describe("ID of the question"),
  code: z.string().describe("Python code submitted by the student"),
  hintsUsed: z.number().int().min(0).default(0).describe("Number of hints consumed"),
  timeSpentSeconds: z.number().int().min(0).default(0).describe("Time spent in seconds"),
  sessionId: z.string().optional().describe("Optional study session ID"),
});

export const submitOutputModel = z.object({
  attemptId: z.string(),
  testResults: z.array(testResultModel),
  testsPassed: z.number(),
  testsFailed: z.number(),
  totalTests: z.number(),
  feedback: z.object({
    text: z.string(),
    strengths: z.array(z.string()),
    missingPoints: z.array(z.string()),
    syntaxValid: z.boolean(),
    errorCategory: z.enum(["syntax", "logic", "runtime"]).nullable(),
  }),
  pointsAwarded: z.number(),
  newTotalPoints: z.number(),
  solved: z.boolean(),
  /** Model answer is revealed only after a submit. */
  modelAnswer: z.string(),
});

// ─── requestCodingHint ────────────────────────────────────────────────────────

export const requestCodingHintInputModel = z.object({
  questionId: z.string().describe("ID of the question"),
  code: z.string().describe("Student's current code"),
  currentHintLevel: z.number().int().min(0).max(4).describe("Last hint level already shown (0 = none)"),
  testResults: z.array(testResultModel).optional().describe("Optional last run test results for context"),
});

export const requestCodingHintOutputModel = z.object({
  hintText: z.string(),
  hintLevel: z.number(),
  isLastHint: z.boolean(),
});
