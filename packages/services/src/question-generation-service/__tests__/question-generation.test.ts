import { describe, it, expect, vi, beforeEach } from "vitest";
import QuestionGenerationService from "../index";

vi.mock("@gcse/database", () => ({
  GeneratedQuestion: {
    findOne: vi.fn(),
    insertOne: vi.fn(),
  },
  Module: {
    findOne: vi.fn(),
  },
  QuestionTemplate: {
    findOne: vi.fn(),
  },
  User: {
    findOne: vi.fn(),
  },
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import { GeneratedQuestion, Module, QuestionTemplate, User } from "@gcse/database";
import Anthropic from "@anthropic-ai/sdk";

const mockModule = {
  _id: { toString: () => "mod1" },
  topicName: "Sequence and Selection",
  examBoard: "generic",
};

const mockTemplate = {
  _id: { toString: () => "tmpl1" },
  questionType: "short_answer",
  promptTemplate: "Explain the difference between a variable and a constant.",
  rubric: {
    maxMarks: 4,
    acceptedConcepts: ["variable", "constant"],
    commonMisconceptions: ["confusing constants with variables"],
  },
};

const mockAIResponse = {
  questionText: "What is the difference between a variable and a constant?",
  maxMarks: 4,
  markSchemePoints: ["p1", "p2", "p3", "p4"],
  hints: ["h1", "h2", "h3", "h4", "h5"],
  modelAnswer: "A variable can change; a constant cannot.",
  misconceptionNotes: ["common mistake"],
};

describe("QuestionGenerationService", () => {
  let svc: QuestionGenerationService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new QuestionGenerationService();
    // Get the mock instance created in constructor
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("returns cached unused question if available", async () => {
    const cached = {
      _id: { toString: () => "q1" },
      moduleId: { toString: () => "mod1" },
      questionType: "short_answer",
      difficulty: "medium",
      questionText: "Cached question?",
      answerFormat: "free_text",
      maxMarks: 4,
      markSchemePoints: ["p1"],
      modelAnswer: "answer",
      hints: ["h1", "h2", "h3", "h4", "h5"],
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Topic", misconceptionNotes: [] },
    };
    (GeneratedQuestion.findOne as any).mockResolvedValue(cached);

    const result = await svc.generateQuestion({
      moduleId: "mod1",
      userId: "user1",
      difficulty: "medium",
    });

    expect(result.id).toBe("q1");
    expect(result.questionText).toBe("Cached question?");
    expect(Module.findOne).not.toHaveBeenCalled();
  });

  it("generates a new question via AI when no cache exists", async () => {
    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(mockModule);
    (QuestionTemplate.findOne as any).mockResolvedValue(mockTemplate);
    (User.findOne as any).mockResolvedValue({ role: "student", parentId: null });
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(mockAIResponse) }],
    });
    const savedDoc = {
      _id: { toString: () => "newq1" },
      moduleId: { toString: () => "mod1" },
      questionType: "short_answer",
      difficulty: "medium",
      questionText: mockAIResponse.questionText,
      answerFormat: "free_text",
      maxMarks: 4,
      markSchemePoints: mockAIResponse.markSchemePoints,
      modelAnswer: mockAIResponse.modelAnswer,
      hints: mockAIResponse.hints,
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Sequence and Selection", misconceptionNotes: [] },
    };
    (GeneratedQuestion.insertOne as any).mockResolvedValue(savedDoc);

    const result = await svc.generateQuestion({
      moduleId: "mod1",
      userId: "user1",
      difficulty: "medium",
    });

    expect(mockClient.messages.create).toHaveBeenCalledOnce();
    expect(result.questionText).toBe(mockAIResponse.questionText);
    expect(result.hints).toHaveLength(5);
  });

  it("handles AI response wrapped in markdown code blocks", async () => {
    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(mockModule);
    (QuestionTemplate.findOne as any).mockResolvedValue(mockTemplate);
    (User.findOne as any).mockResolvedValue({ role: "student", parentId: null });
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + JSON.stringify(mockAIResponse) + "\n```" }],
    });
    (GeneratedQuestion.insertOne as any).mockResolvedValue({
      _id: { toString: () => "q2" },
      moduleId: { toString: () => "mod1" },
      questionType: "short_answer",
      difficulty: "medium",
      questionText: mockAIResponse.questionText,
      answerFormat: "free_text",
      maxMarks: 4,
      markSchemePoints: mockAIResponse.markSchemePoints,
      modelAnswer: mockAIResponse.modelAnswer,
      hints: mockAIResponse.hints,
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Topic", misconceptionNotes: [] },
    });

    const result = await svc.generateQuestion({ moduleId: "mod1", userId: "user1" });
    expect(result.questionText).toBe(mockAIResponse.questionText);
  });

  it("throws if module not found", async () => {
    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(null);

    await expect(
      svc.generateQuestion({ moduleId: "bad-id", userId: "user1" }),
    ).rejects.toThrow("Module not found");
  });

  it("coding template generates question with answerFormat 'code' and testCases populated", async () => {
    const codingTemplate = {
      _id: { toString: () => "tmpl2" },
      questionType: "coding",
      promptTemplate: "Write a Python function that squares a number.",
      rubric: {
        maxMarks: 6,
        acceptedConcepts: ["function", "return"],
        commonMisconceptions: ["not returning a value"],
      },
    };

    const codingAIResponse = {
      questionText: "Write a Python function square(n) that returns n squared.",
      maxMarks: 6,
      testCases: [
        { input: "5", expectedOutput: "25", hidden: false },
        { input: "3", expectedOutput: "9", hidden: false },
        { input: "-2", expectedOutput: "4", hidden: true },
      ],
      markSchemePoints: ["p1", "p2", "p3", "p4", "p5", "p6"],
      modelAnswer: "def square(n):\n    return n * n",
      hints: ["h1", "h2", "h3", "h4", "h5"],
      misconceptionNotes: ["forgetting to return"],
    };

    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(mockModule);
    (QuestionTemplate.findOne as any).mockResolvedValue(codingTemplate);
    (User.findOne as any).mockResolvedValue({ role: "student", parentId: null });
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(codingAIResponse) }],
    });

    const savedDoc = {
      _id: { toString: () => "codingq1" },
      moduleId: { toString: () => "mod1" },
      questionType: "coding",
      difficulty: "medium",
      questionText: codingAIResponse.questionText,
      answerFormat: "code",
      maxMarks: 6,
      markSchemePoints: codingAIResponse.markSchemePoints,
      modelAnswer: codingAIResponse.modelAnswer,
      hints: codingAIResponse.hints,
      testCases: codingAIResponse.testCases,
      metadata: { examBoard: "generic", topicName: "Sequence and Selection", misconceptionNotes: [] },
    };
    (GeneratedQuestion.insertOne as any).mockResolvedValue(savedDoc);

    const result = await svc.generateQuestion({
      moduleId: "mod1",
      userId: "user1",
      difficulty: "medium",
    });

    expect(result.answerFormat).toBe("code");
    expect(result.testCases.length).toBeGreaterThanOrEqual(3);
  });

  it("generateQuestionSupport throws when AI returns fewer than 3 test cases for a coding question", async () => {
    const partialQuestion = {
      _id: { toString: () => "q-partial" },
      moduleId: { toString: () => "mod1" },
      templateId: null,
      userId: { toString: () => "user1" },
      questionType: "coding",
      difficulty: "easy",
      questionText: "Write a function.",
      answerFormat: "code",
      maxMarks: 4,
      markSchemePoints: [],
      modelAnswer: "",
      hints: [],
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Sequence and Selection", misconceptionNotes: [] },
      supportReady: false,
      deletedAt: null,
    };

    const insufficientSupportResponse = {
      markSchemePoints: ["p1", "p2", "p3", "p4"],
      modelAnswer: "def f(n): return n",
      hints: ["h1", "h2", "h3"],
      testCases: [{ input: "1", expectedOutput: "1", hidden: false }],
      misconceptionNotes: [],
    };

    (GeneratedQuestion.findOne as any).mockResolvedValue(partialQuestion);
    (Module.findOne as any).mockResolvedValue(mockModule);
    (User.findOne as any).mockResolvedValue({ role: "student", parentId: null });
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(insufficientSupportResponse) }],
    });

    await expect(
      svc.generateQuestionSupport("q-partial"),
    ).rejects.toThrow("Invalid coding support: insufficient test cases from AI");
  });
});
