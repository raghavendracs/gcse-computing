import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: vi.fn() } })),
}));
vi.mock("@gcse/database", () => ({
  Question: { findOne: vi.fn(), updateOne: vi.fn() },
}));
vi.mock("../../code-execution-service", () => ({
  default: vi.fn().mockImplementation(() => ({ execute: vi.fn() })),
}));

import Anthropic from "@anthropic-ai/sdk";
import AgenticEvalService from "../index";

const valid = {
  summary: "Good start — you read the input and loop correctly.",
  matched: ["Reads the starting balance", "Uses a loop"],
  gaps: [{ title: "Empty input", detail: "Nothing is printed when there are no transactions.", severity: "edge_case" }],
  likelyComplete: false,
};

describe("AgenticEvalService.analyze", () => {
  let svc: AgenticEvalService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AgenticEvalService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("parses a valid analysis response", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(valid) }],
    });

    const r = await svc.analyze({
      questionText: "Sum transactions.",
      submittedCode: "pass",
      modelAnswer: "print(1)",
      divergences: [{ input: "", referenceOutput: "0", studentOutput: "" }],
      revealAnswer: false,
    });

    expect(r.summary).toContain("Good start");
    expect(r.matched).toHaveLength(2);
    expect(r.gaps[0].severity).toBe("edge_case");
    expect(r.likelyComplete).toBe(false);
  });

  it("returns a graceful fallback on a malformed response", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "sorry, not json" }],
    });

    const r = await svc.analyze({
      questionText: "Q",
      submittedCode: "pass",
      modelAnswer: "print(1)",
      divergences: [],
      revealAnswer: true,
    });

    expect(r).toEqual({ summary: "Automated analysis unavailable.", matched: [], gaps: [], likelyComplete: null });
  });

  it("forbids leaking the solution in the system prompt when revealAnswer is false", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(valid) }],
    });

    await svc.analyze({
      questionText: "Q",
      submittedCode: "pass",
      modelAnswer: "print(1)",
      divergences: [],
      revealAnswer: false,
    });

    const call = mockClient.messages.create.mock.calls[0][0];
    expect(call.system).toContain("corrected program");
  });
});
