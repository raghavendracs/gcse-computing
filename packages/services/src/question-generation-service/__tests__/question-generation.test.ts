import { describe, it, expect, vi, beforeEach } from "vitest";
import QuestionGenerationService from "../index";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

import Anthropic from "@anthropic-ai/sdk";

const validSeedResponse = {
  questionText: "Write a Python program that reads a number from the user and prints its square.",
  testCases: [
    { input: "5", expectedOutput: "25", hidden: false, description: "normal case: 5 squared" },
    { input: "3", expectedOutput: "9", hidden: false, description: "normal case: 3 squared" },
    { input: "0", expectedOutput: "0", hidden: false, description: "edge case: zero" },
    { input: "-4", expectedOutput: "16", hidden: true, description: "hidden edge case: negative number" },
  ],
  hints: [
    "Think about how to read a number from the user.",
    "You can use the ** operator or multiply the number by itself.",
    "Make sure to convert the input to an integer before squaring.",
  ],
  modelAnswer: "n = int(input())\nprint(n * n)",
};

describe("QuestionGenerationService", () => {
  let svc: QuestionGenerationService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new QuestionGenerationService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("returns parsed seed question with at least 4 test cases", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validSeedResponse) }],
    });

    const result = await svc.generateSeedQuestion({
      topicName: "Sequence and Selection",
      topicDescription: "Writing simple programs using sequence and selection",
      difficulty: "easy",
      questionType: "write",
    });

    expect(result.questionText).toBe(validSeedResponse.questionText);
    expect(result.testCases.length).toBeGreaterThanOrEqual(4);
    expect(result.hints).toHaveLength(3);
    expect(result.modelAnswer).toBeTruthy();
    // write type — no starterCode
    expect(result.starterCode).toBeUndefined();
    // at least one hidden test case
    expect(result.testCases.some(tc => tc.hidden)).toBe(true);
    // at least one edge case (by description)
    expect(result.testCases.some(tc => tc.description.toLowerCase().includes("edge"))).toBe(true);
  });

  it("parses AI response wrapped in markdown fences", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + JSON.stringify(validSeedResponse) + "\n```" }],
    });

    const result = await svc.generateSeedQuestion({
      topicName: "Loops",
      topicDescription: "Using for loops to iterate",
      difficulty: "medium",
      questionType: "write",
    });

    expect(result.questionText).toBeTruthy();
    expect(result.testCases.length).toBeGreaterThanOrEqual(4);
  });

  it("throws when AI returns fewer than 4 test cases", async () => {
    const tooFewTestCases = {
      questionText: "Write a program.",
      testCases: [
        { input: "1", expectedOutput: "1", hidden: false, description: "basic case" },
        { input: "2", expectedOutput: "2", hidden: true, description: "hidden case" },
      ],
      hints: ["hint 1", "hint 2", "hint 3"],
      modelAnswer: "print(int(input()))",
    };

    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(tooFewTestCases) }],
    });

    await expect(
      svc.generateSeedQuestion({
        topicName: "Loops",
        topicDescription: "Using for loops",
        difficulty: "easy",
        questionType: "write",
      }),
    ).rejects.toThrow();
  });
});
