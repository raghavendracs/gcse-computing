import { describe, it, expect, vi, beforeEach } from "vitest";
import TheoryMarkingService from "../index";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import Anthropic from "@anthropic-ai/sdk";

const validMarkingResponse = {
  awardedMarks: 3,
  feedback: "Good explanation of variables. You missed the constant example.",
  missingPoints: ["Example of a constant"],
  strengths: ["Correctly defined variable", "Mentioned values can change"],
  confidence: 0.9,
};

describe("TheoryMarkingService", () => {
  let svc: TheoryMarkingService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new TheoryMarkingService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("returns valid assessment for a good answer", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validMarkingResponse) }],
    });

    const result = await svc.markAnswer({
      questionText: "Explain the difference between a variable and a constant.",
      markSchemePoints: ["p1", "p2", "p3", "p4"],
      submittedAnswer: "A variable can change but a constant cannot.",
      maxMarks: 4,
    });

    expect(result.awardedMarks).toBe(3);
    expect(result.feedback).toBeTruthy();
    expect(result.missingPoints).toHaveLength(1);
    expect(result.strengths).toHaveLength(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("clamps awardedMarks to maxMarks", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...validMarkingResponse, awardedMarks: 99 }),
        },
      ],
    });

    const result = await svc.markAnswer({
      questionText: "Q?",
      markSchemePoints: ["p1", "p2"],
      submittedAnswer: "answer",
      maxMarks: 2,
    });

    expect(result.awardedMarks).toBe(2);
  });

  it("clamps confidence between 0 and 1", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...validMarkingResponse, confidence: 1.5 }),
        },
      ],
    });

    const result = await svc.markAnswer({
      questionText: "Q?",
      markSchemePoints: ["p1"],
      submittedAnswer: "answer",
      maxMarks: 1,
    });

    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("parses AI response wrapped in markdown code blocks", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "```json\n" + JSON.stringify(validMarkingResponse) + "\n```",
        },
      ],
    });

    const result = await svc.markAnswer({
      questionText: "Q?",
      markSchemePoints: ["p1", "p2", "p3", "p4"],
      submittedAnswer: "answer",
      maxMarks: 4,
    });

    expect(result.awardedMarks).toBe(3);
  });

  it("always uses claude-haiku model", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validMarkingResponse) }],
    });

    await svc.markAnswer({
      questionText: "Q?",
      markSchemePoints: ["p1"],
      submittedAnswer: "answer",
      maxMarks: 1,
    });

    expect(mockClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
    );
  });
});
