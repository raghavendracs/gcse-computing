import Anthropic from "@anthropic-ai/sdk";
import { GeneratedQuestion, Module, QuestionTemplate, User } from "@gcse/database";
import { Types } from "mongoose";
import { getModelId } from "../ai/model-map";
import { type GenerateQuestionInput, type GeneratedQuestionOutput } from "./models";

class QuestionGenerationService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestionOutput> {
    const { moduleId, userId, difficulty = "medium", examBoard } = input;

    // 1. Return cached unused question if available
    const cacheConditions: object[] = [
      { userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId },
      { moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId },
      { difficulty },
      { usedInSession: false },
    ];
    if (examBoard) {
      cacheConditions.push({ "metadata.examBoard": { $in: [examBoard, "generic"] } });
    }
    const cached = await GeneratedQuestion.findOne({ $and: cacheConditions });
    if (cached) return this.toOutput(cached);

    // 2. Load module
    const mod = await Module.findOne({
      _id: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
    });
    if (!mod) throw new Error("Module not found");

    // 3. Find a matching template
    const template = await QuestionTemplate.findOne({
      $and: [
        {
          moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
        },
        { active: true },
      ],
    });

    // 4. Resolve AI model from user/parent preference
    const modelId = await this.resolveModel(userId);

    // 5. Generate via AI
    const generated = await this.callAI(mod, template, difficulty, examBoard, modelId);

    // 6. Save and return
    const doc = await GeneratedQuestion.insertOne({
      moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
      templateId: template ? template._id : undefined,
      userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
      questionType: template?.questionType ?? "short_answer",
      difficulty,
      questionText: generated.questionText,
      answerFormat: "free_text",
      maxMarks: generated.maxMarks,
      markSchemePoints: generated.markSchemePoints,
      modelAnswer: generated.modelAnswer,
      hints: generated.hints,
      testCases: [],
      metadata: {
        examBoard: examBoard ?? mod.examBoard,
        topicName: mod.topicName,
        misconceptionNotes: generated.misconceptionNotes,
      },
      usedInSession: false,
    });

    return this.toOutput(doc);
  }

  private async resolveModel(userId: string): Promise<string> {
    const user = await User.findOne({
      _id: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
    });
    if (!user) return getModelId("balanced");
    if (user.role === "parent") return getModelId(user.aiModelPreference ?? "balanced");
    if (user.parentId) {
      const parent = await User.findOne({ _id: user.parentId });
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
  ): Promise<{
    questionText: string;
    maxMarks: number;
    markSchemePoints: string[];
    hints: string[];
    modelAnswer: string;
    misconceptionNotes: string[];
  }> {
    const systemPrompt = `You are a GCSE Computer Science examiner. Generate exam-style questions in valid JSON only.
Output ONLY a JSON object with exactly these fields:
{
  "questionText": "the question text",
  "maxMarks": 4,
  "markSchemePoints": ["point 1", "point 2", "..."],
  "hints": ["hint 1", "hint 2", "hint 3", "hint 4", "hint 5"],
  "modelAnswer": "full model answer",
  "misconceptionNotes": ["common mistake 1"]
}
Rules:
- hints must have exactly 5 items, progressively more helpful; hint 5 is near-solution scaffolding, never the full answer
- number of markSchemePoints must equal maxMarks (one point per mark)
- questionText must be self-contained and appropriate for ${difficulty} difficulty
- modelAnswer must address all mark scheme points`;

    const templateContext = template
      ? `Base template: "${template.promptTemplate}"
Key concepts: ${template.rubric.acceptedConcepts.join(", ")}
Common misconceptions to address in hints: ${template.rubric.commonMisconceptions.join(", ")}`
      : "";

    const userPrompt = `Generate a ${difficulty} short_answer question about "${mod.topicName}" for ${examBoard ?? mod.examBoard} GCSE.
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
      parsed.hints.length !== 5 ||
      typeof parsed.modelAnswer !== "string"
    ) {
      throw new Error("Invalid question structure from AI");
    }

    return {
      questionText: parsed.questionText,
      maxMarks: parsed.maxMarks,
      markSchemePoints: parsed.markSchemePoints,
      hints: parsed.hints,
      modelAnswer: parsed.modelAnswer,
      misconceptionNotes: Array.isArray(parsed.misconceptionNotes) ? parsed.misconceptionNotes : [],
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
