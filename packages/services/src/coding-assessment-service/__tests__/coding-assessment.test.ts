import { describe, it, expect, vi, beforeEach } from "vitest";
import CodingAssessmentService from "../index";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

import Anthropic from "@anthropic-ai/sdk";

const validResponse = {
  awardedMarks: 4,
  feedback: "Good use of a loop accumulator. Missing input conversion.",
  missingPoints: ["Converts input to int"],
  strengths: ["Loop runs 5 times", "Accumulator initialised"],
  confidence: 0.85,
  syntaxValid: true,
  errorCategory: null,
};

describe("CodingAssessmentService", () => {
  let svc: CodingAssessmentService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CodingAssessmentService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("returns valid assessment with codingAnalysis", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validResponse) }],
    });

    const result = await svc.assessCode({
      questionText: "Write a loop that sums 5 numbers.",
      submittedCode: "total = 0\nfor i in range(5):\n    total += input()",
      testResults: [
        { input: "1", expectedOutput: "1", actualOutput: "Error", passed: false, hidden: false },
      ],
      markSchemePoints: ["p1", "p2", "p3", "p4", "p5", "p6"],
      maxMarks: 6,
      modelId: "claude-haiku-4-5-20251001",
    });

    expect(result.awardedMarks).toBe(4);
    expect(result.syntaxValid).toBe(true);
    expect(result.errorCategory).toBeNull();
    expect(result.strengths).toHaveLength(2);
  });

  it("clamps awardedMarks to maxMarks", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ ...validResponse, awardedMarks: 99 }) }],
    });

    const result = await svc.assessCode({
      questionText: "Q",
      submittedCode: "pass",
      testResults: [],
      markSchemePoints: ["p1"],
      maxMarks: 2,
      modelId: "claude-haiku-4-5-20251001",
    });

    expect(result.awardedMarks).toBe(2);
  });

  it("parses AI response wrapped in markdown fences", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + JSON.stringify(validResponse) + "\n```" }],
    });

    const result = await svc.assessCode({
      questionText: "Q",
      submittedCode: "pass",
      testResults: [],
      markSchemePoints: ["p1"],
      maxMarks: 6,
      modelId: "claude-haiku-4-5-20251001",
    });

    expect(result.feedback).toBeTruthy();
  });
});
