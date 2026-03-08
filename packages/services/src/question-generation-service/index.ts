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

    // 1. Return cached unused question if available
    const cacheConditions: object[] = [
      { userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId },
      { moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId },
      { difficulty },
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

    // 3. Find a matching template (filtered by mode)
    const templateConditions: object[] = [
      {
        moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
      },
      { active: true },
    ];
    if (mode === "theory") {
      templateConditions.push({ questionType: { $in: THEORY_QUESTION_TYPES } });
    } else if (mode === "coding") {
      templateConditions.push({ questionType: { $in: CODING_QUESTION_TYPES } });
    }
    const template = await QuestionTemplate.findOne({ $and: templateConditions });

    // 4. Resolve AI model from user/parent preference
    const modelId = await this.resolveModelForUser(userId);

    // 5. Generate via AI
    const generated = await this.callAI(mod, template, difficulty, examBoard, modelId, mode);

    // 6. Save and return
    const isCoding =
      mode === "coding" ||
      (!mode && (template?.questionType === "coding" || template?.questionType === "fix_code"));
    const doc = await GeneratedQuestion.insertOne({
      moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
      templateId: template ? template._id : undefined,
      userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
      questionType: template?.questionType ?? (isCoding ? "coding" : "short_answer"),
      difficulty,
      questionText: generated.questionText,
      answerFormat: isCoding ? "code" : "free_text",
      maxMarks: generated.maxMarks,
      markSchemePoints: generated.markSchemePoints,
      modelAnswer: generated.modelAnswer,
      hints: generated.hints,
      testCases: generated.testCases ?? [],
      metadata: {
        examBoard: examBoard ?? mod.examBoard,
        topicName: mod.topicName,
        misconceptionNotes: generated.misconceptionNotes,
      },
      usedInSession: false,
    });

    return this.toOutput(doc);
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

  private async callAI(
    mod: any,
    template: any | null,
    difficulty: string,
    examBoard: string | undefined,
    modelId: string,
    mode?: string,
  ): Promise<{
    questionText: string;
    maxMarks: number;
    markSchemePoints: string[];
    hints: string[];
    modelAnswer: string;
    misconceptionNotes: string[];
    testCases: { input: string; expectedOutput: string; hidden: boolean }[];
  }> {
    const isCoding =
      mode === "coding" ||
      (!mode && (template?.questionType === "coding" || template?.questionType === "fix_code"));

    const systemPrompt = isCoding
      ? `You are an Edexcel GCSE Computer Science examiner (specification 1CP2, Component 02 — Application of Computational Thinking). Generate Python coding questions in valid JSON only.

Output ONLY a JSON object with exactly these fields:
{
  "questionText": "question text here",
  "maxMarks": 6,
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

QUESTION TYPE — rotate through these:
- write-from-scratch: "Write a Python program that..." (4-8 marks) — most common
- fix-the-code: "The following Python program contains errors. Identify and correct them." then show broken code in \`\`\`python block (3-4 marks)
- extend-the-code: "The program below is incomplete. Add the missing part to..." then show partial code in \`\`\`python block (3-5 marks)
- predict-output: "What is the output of the following Python program?" then show code in \`\`\`python block (1-2 marks, no test cases needed for this type)

DIFFICULTY:
- easy: simple sequence/selection (if/else), basic arithmetic, print statements
- medium: iteration (for/while loops), lists, functions with parameters and return values
- hard: nested loops, 2D lists, string manipulation, multiple functions, file-style problems

PYTHON 3 rules:
- All code must be valid Python 3
- Input is passed via function parameters (not input()), unless the question specifically tests input()
- modelAnswer must be complete working Python 3 code

TEST CASES:
- minimum 2 visible (hidden: false) + 1 hidden (hidden: true)
- For predict-output questions, you may use empty testCases []
- Test edge cases (0, negative, empty string, single item)

MARK SCHEME:
- "Award 1 mark for [specific construct/logic]. e.g. correct loop structure"
- Number of markSchemePoints must equal maxMarks

HINTS: exactly 3, progressively more helpful. Hint 3 gives pseudocode structure (never full solution).

FORMATTING: wrap any code shown to the student in a \`\`\`python block.`
      : `You are an Edexcel GCSE Computer Science examiner (specification 1CP2). Generate exam-style questions in valid JSON only.

Output ONLY a JSON object with exactly these fields:
{
  "questionText": "question text here",
  "maxMarks": 4,
  "markSchemePoints": ["Award 1 mark for...", "Award 1 mark for..."],
  "hints": ["hint 1", "hint 2", "hint 3"],
  "modelAnswer": "full model answer here",
  "misconceptionNotes": ["common mistake 1"]
}

QUESTION TYPE — choose the most appropriate for the topic and difficulty:
- easy (1-2 marks): "State one...", "Name two...", "Give an example of...", "Define the term..."
- medium (3-4 marks): "Describe how...", "Explain why...", "Give two differences between X and Y (one mark per difference, one mark per explanation)", OR a trace-table question with pseudocode showing variable values through iterations
- hard (5-6 marks): "Evaluate...", "Compare and contrast...", "Discuss the advantages and disadvantages of..."

For ALGORITHM/LOGIC topics (sorting, searching, logic gates, binary, truth tables):
- Include trace-table questions: show pseudocode in a \`\`\`pseudocode block, ask student to complete a table of variable values
- Or predict-output questions: show pseudocode, ask what the output is
- Truth table questions for logic gate topics

MARK SCHEME format:
- Each markSchemePoints entry = exactly 1 mark
- Format: "Award 1 mark for [specific answer]. Accept: [alternative wording]."
- Number of entries must equal maxMarks

HINTS: exactly 3, progressively more helpful. Hint 3 is near-answer scaffolding (never give the full answer).

FORMATTING:
- For any pseudocode or code the student must read: wrap in triple backtick block with language label (pseudocode or python)
- For multi-part questions (4+ marks): use (a), (b) on separate lines with [N marks] after each part
- Student answers in PLAIN TEXT only — never ask them to write Python code

IMPORTANT: Do NOT ask the student to write any programs or code.`;

    const templateContext = template
      ? `Base template: "${template.promptTemplate}"
Key concepts: ${template.rubric.acceptedConcepts.join(", ")}
Common misconceptions to address in hints: ${template.rubric.commonMisconceptions.join(", ")}`
      : "";

    const userPrompt = `Generate a ${difficulty} ${isCoding ? "coding" : "short_answer"} question about "${mod.topicName}" for ${examBoard ?? mod.examBoard} GCSE.
${templateContext}
Max marks: ${template?.rubric.maxMarks ?? 4}`;

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
      typeof parsed.questionText !== "string" ||
      typeof parsed.maxMarks !== "number" ||
      !Array.isArray(parsed.markSchemePoints) ||
      !Array.isArray(parsed.hints) ||
      parsed.hints.length < 1 ||
      typeof parsed.modelAnswer !== "string"
    ) {
      throw new Error("Invalid question structure from AI");
    }

    if (isCoding && (!Array.isArray(parsed.testCases) || parsed.testCases.length < 3)) {
      throw new Error("Invalid coding question: insufficient test cases from AI");
    }

    return {
      questionText: parsed.questionText,
      maxMarks: parsed.maxMarks,
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
      metadata: {
        examBoard: doc.metadata?.examBoard ?? "",
        topicName: doc.metadata?.topicName ?? "",
        misconceptionNotes: doc.metadata?.misconceptionNotes ?? [],
      },
    };
  }
}

export default QuestionGenerationService;
