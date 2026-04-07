import Anthropic from "@anthropic-ai/sdk";
import { GeneratedQuestion, Module, QuestionTemplate, User } from "@gcse/database";
import { Types } from "mongoose";
import { getModelId } from "../ai/model-map";
import { type GenerateQuestionInput, type GeneratedQuestionOutput } from "./models";

const THEORY_QUESTION_TYPES = [
  "multiple_choice",
  "short_answer",
  "extended",
  "trace_table",
  "fill_gap",
  "predict_output",
] as const;

const CODING_QUESTION_TYPES = ["coding", "fix_code"] as const;

class QuestionGenerationService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestionOutput> {
    const { moduleId, userId, difficulty = "medium", examBoard, mode } = input;

    // 1. Return cached unused question if available (already has all data)
    const cacheConditions: object[] = [
      { userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId },
      { moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId },
      { difficulty },
      { supportReady: true },
      {
        $or: [
          { usedInSession: false },
          { usedInSession: true, nextReviewAt: { $exists: true, $lte: new Date() } },
        ],
      },
      {
        $or: [
          { nextReviewAt: { $exists: false } },
          { nextReviewAt: { $lte: new Date() } },
        ],
      },
    ];
    if (examBoard) {
      cacheConditions.push({ "metadata.examBoard": { $in: [examBoard, "generic"] } });
    }
    if (mode === "theory") {
      cacheConditions.push({ answerFormat: "free_text" });
    } else if (mode === "coding") {
      cacheConditions.push({ answerFormat: "code" });
    }
    const cached = await GeneratedQuestion.findOne({ $and: cacheConditions });
    if (cached) return this.toOutput(cached);

    // 2. Load module
    const mod = await Module.findOne({
      _id: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
    });
    if (!mod) throw new Error("Module not found");

    // 3. Find a matching template
    const templateConditions: object[] = [
      { moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId },
      { active: true },
    ];
    if (mode === "theory") {
      templateConditions.push({ questionType: { $in: THEORY_QUESTION_TYPES } });
    } else if (mode === "coding") {
      templateConditions.push({ questionType: { $in: CODING_QUESTION_TYPES } });
    }
    const template = await QuestionTemplate.findOne({ $and: templateConditions });

    // 4. Resolve AI model
    const modelId = await this.resolveModelForUser(userId);

    // 5. Generate ONLY the core question via AI (fast call)
    const { questionText, maxMarks, isCoding } = await this.callAICoreQuestion(
      mod, template, difficulty, examBoard, modelId, mode,
    );

    // 6. Save partial question with supportReady: false
    const doc = await GeneratedQuestion.insertOne({
      moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
      templateId: template ? template._id : undefined,
      userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
      questionType: template?.questionType ?? (isCoding ? "coding" : "short_answer"),
      difficulty,
      questionText,
      answerFormat: isCoding ? "code" : "free_text",
      maxMarks,
      markSchemePoints: [],
      modelAnswer: "",
      hints: [],
      testCases: [],
      metadata: {
        examBoard: examBoard ?? mod.examBoard,
        topicName: mod.topicName,
        misconceptionNotes: [],
      },
      usedInSession: false,
      supportReady: false,
    });

    return this.toOutput(doc);
  }

  async generateQuestionSupport(questionId: string): Promise<{
    hints: string[];
    modelAnswer: string;
    markSchemePoints: string[];
    testCases: { input: string; expectedOutput: string; hidden: boolean }[];
    misconceptionNotes: string[];
  }> {
    const question = await GeneratedQuestion.findOne({
      _id: Types.ObjectId.isValid(questionId) ? new Types.ObjectId(questionId) : questionId,
      deletedAt: null,
    });
    if (!question) throw new Error("Question not found");

    // If already ready (cached path), return existing data
    if (question.supportReady) {
      return {
        hints: question.hints,
        modelAnswer: question.modelAnswer,
        markSchemePoints: question.markSchemePoints,
        testCases: question.testCases.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          hidden: tc.hidden,
        })),
        misconceptionNotes: question.metadata.misconceptionNotes,
      };
    }

    const mod = await Module.findOne({ _id: question.moduleId });
    if (!mod) throw new Error("Module not found");

    const modelId = await this.resolveModelForUser(question.userId.toString());
    const isCoding = question.answerFormat === "code";

    const template = question.templateId
      ? await QuestionTemplate.findOne({ _id: question.templateId })
      : null;

    const support = await this.callAISupportData(
      question.questionText,
      question.maxMarks,
      mod,
      template,
      question.difficulty,
      question.metadata.examBoard,
      modelId,
      isCoding,
    );

    // Update the DB record
    await GeneratedQuestion.updateOne(
      { _id: question._id },
      {
        $set: {
          hints: support.hints,
          modelAnswer: support.modelAnswer,
          markSchemePoints: support.markSchemePoints,
          testCases: support.testCases,
          "metadata.misconceptionNotes": support.misconceptionNotes,
          supportReady: true,
        },
      },
    );

    return support;
  }

  public async resolveModelForUser(userId: string): Promise<string> {
    const user = await User.findOne({
      _id: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
      deletedAt: null,
    });
    if (!user) return getModelId("balanced");
    if (user.role === "parent") return getModelId(user.aiModelPreference ?? "balanced");
    if (user.parentId) {
      const parent = await User.findOne({ _id: user.parentId, deletedAt: null });
      return getModelId(parent?.aiModelPreference ?? "balanced");
    }
    return getModelId("balanced");
  }

  private async callAICoreQuestion(
    mod: any,
    template: any | null,
    difficulty: string,
    examBoard: string | undefined,
    modelId: string,
    mode?: string,
  ): Promise<{ questionText: string; maxMarks: number; isCoding: boolean }> {
    const isCoding =
      mode === "coding" ||
      (!mode && (template?.questionType === "coding" || template?.questionType === "fix_code"));

    const systemPrompt = isCoding
      ? `You are an Edexcel GCSE Computer Science examiner. Generate ONLY the question text for a Python coding question in valid JSON.

Output ONLY a JSON object with exactly these fields:
{
  "questionText": "question text here (wrap any code in \`\`\`python blocks)",
  "maxMarks": 6
}

QUESTION TYPE — rotate through these:
- write-from-scratch: "Write a Python program that..." (4-8 marks)
- fix-the-code: "The following Python program contains errors. Identify and correct them." (3-4 marks)
- extend-the-code: "The program below is incomplete. Add the missing part to..." (3-5 marks)
- predict-output: "What is the output of the following Python program?" (1-2 marks)

DIFFICULTY: easy = simple sequence/selection; medium = iteration/lists/functions; hard = nested loops/2D lists/multiple functions`
      : `You are an Edexcel GCSE Computer Science examiner. Generate ONLY the question text in valid JSON.

Output ONLY a JSON object with exactly these fields:
{
  "questionText": "question text here",
  "maxMarks": 4
}

QUESTION TYPE based on difficulty:
- easy (1-2 marks): "State one...", "Name two...", "Define..."
- medium (3-4 marks): "Describe how...", "Explain why...", trace-table with pseudocode
- hard (5-6 marks): "Evaluate...", "Compare and contrast...", "Discuss advantages/disadvantages..."

For ALGORITHM/LOGIC topics: use trace-table or predict-output questions with \`\`\`pseudocode blocks.
IMPORTANT: Do NOT ask the student to write any programs or code.`;

    const templateContext = template
      ? `Base template: "${template.promptTemplate}"\nKey concepts: ${template.rubric.acceptedConcepts.join(", ")}`
      : "";

    const userPrompt = `Generate a ${difficulty} question about "${mod.topicName}" for ${examBoard ?? mod.examBoard} GCSE. Return ONLY the questionText and maxMarks fields.
${templateContext}
Max marks: ${template?.rubric.maxMarks ?? 4}`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 512,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    const jsonStr = content.text
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(jsonStr);

    if (typeof parsed.questionText !== "string" || typeof parsed.maxMarks !== "number") {
      throw new Error("Invalid core question structure from AI");
    }

    return { questionText: parsed.questionText, maxMarks: parsed.maxMarks, isCoding };
  }

  private async callAISupportData(
    questionText: string,
    maxMarks: number,
    mod: any,
    template: any | null,
    difficulty: string,
    examBoard: string | undefined,
    modelId: string,
    isCoding: boolean,
  ): Promise<{
    markSchemePoints: string[];
    hints: string[];
    modelAnswer: string;
    misconceptionNotes: string[];
    testCases: { input: string; expectedOutput: string; hidden: boolean }[];
  }> {
    const systemPrompt = isCoding
      ? `You are an Edexcel GCSE Computer Science examiner. Given a coding question, generate the supporting material in valid JSON only.

Output ONLY a JSON object with exactly these fields:
{
  "testCases": [
    { "input": "5", "expectedOutput": "25", "hidden": false },
    { "input": "3", "expectedOutput": "9", "hidden": false },
    { "input": "-2", "expectedOutput": "4", "hidden": true }
  ],
  "markSchemePoints": ["Award 1 mark for..."],
  "modelAnswer": "def solution(n):\\n    return n * n",
  "hints": ["hint 1", "hint 2", "hint 3"],
  "misconceptionNotes": ["common mistake"]
}

TEST CASES: minimum 2 visible (hidden: false) + 1 hidden (hidden: true). Test edge cases.
MARK SCHEME: one entry per mark, format "Award 1 mark for [specific construct]".
HINTS: exactly 3, progressively more helpful. Hint 3 gives pseudocode structure (never full solution).
MODEL ANSWER: complete working Python 3 code.`
      : `You are an Edexcel GCSE Computer Science examiner. Given a theory question, generate the supporting material in valid JSON only.

Output ONLY a JSON object with exactly these fields:
{
  "markSchemePoints": ["Award 1 mark for...", "Award 1 mark for..."],
  "hints": ["hint 1", "hint 2", "hint 3"],
  "modelAnswer": "full model answer here",
  "misconceptionNotes": ["common mistake 1"]
}

MARK SCHEME: each entry = exactly 1 mark, format "Award 1 mark for [specific answer]. Accept: [alternative]."
HINTS: exactly 3, progressively more helpful. Hint 3 is near-answer scaffolding (never full answer).`;

    const userPrompt = `Question: "${questionText}"
Topic: "${mod.topicName}", Exam board: ${examBoard ?? mod.examBoard}, Difficulty: ${difficulty}, Max marks: ${maxMarks}

Generate ONLY the supporting material (${isCoding ? "testCases, " : ""}markSchemePoints, hints, modelAnswer, misconceptionNotes).`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    const jsonStr = content.text
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(jsonStr);

    if (
      !Array.isArray(parsed.markSchemePoints) ||
      !Array.isArray(parsed.hints) ||
      parsed.hints.length < 1 ||
      typeof parsed.modelAnswer !== "string"
    ) {
      throw new Error("Invalid support data structure from AI");
    }

    if (isCoding && (!Array.isArray(parsed.testCases) || parsed.testCases.length < 3)) {
      throw new Error("Invalid coding support: insufficient test cases from AI");
    }

    return {
      markSchemePoints: parsed.markSchemePoints,
      hints: parsed.hints,
      modelAnswer: parsed.modelAnswer,
      misconceptionNotes: Array.isArray(parsed.misconceptionNotes) ? parsed.misconceptionNotes : [],
      testCases: isCoding ? parsed.testCases : [],
    };
  }

  private toOutput(doc: any): GeneratedQuestionOutput {
    return {
      id: doc._id.toString(),
      moduleId: doc.moduleId.toString(),
      questionType: doc.questionType,
      difficulty: doc.difficulty as "easy" | "medium" | "hard",
      questionText: doc.questionText,
      answerFormat: doc.answerFormat as "free_text" | "code" | "multiple_choice",
      maxMarks: doc.maxMarks,
      markSchemePoints: doc.markSchemePoints ?? [],
      modelAnswer: doc.modelAnswer ?? "",
      hints: doc.hints ?? [],
      testCases: doc.testCases ?? [],
      supportReady: doc.supportReady ?? false,
      metadata: {
        examBoard: doc.metadata?.examBoard ?? "",
        topicName: doc.metadata?.topicName ?? "",
        misconceptionNotes: doc.metadata?.misconceptionNotes ?? [],
      },
    };
  }
}

export default QuestionGenerationService;
