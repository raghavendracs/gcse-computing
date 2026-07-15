import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindOne = vi.hoisted(() => vi.fn());
const mockUpdateOne = vi.hoisted(() => vi.fn());
const mockExecute = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: vi.fn() } })),
}));
vi.mock("@gcse/database", () => ({
  Question: { findOne: mockFindOne, updateOne: mockUpdateOne },
}));
vi.mock("../../code-execution-service", () => ({
  default: vi.fn().mockImplementation(() => ({ execute: mockExecute })),
}));

import Anthropic from "@anthropic-ai/sdk";
import AgenticEvalService from "../index";

const QID = "507f1f77bcf86cd799439011";

function execResult(rows: { actualOutput: string }[]) {
  return {
    testResults: rows.map((r) => ({ input: "", expectedOutput: "", actualOutput: r.actualOutput, passed: false, hidden: false })),
    stderr: "",
    executionTimeMs: 1,
    timedOut: false,
    blocked: false,
    blockReason: null,
    executionPath: "sandbox",
  };
}

describe("AgenticEvalService", () => {
  let svc: AgenticEvalService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AgenticEvalService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  describe("ensureEvalCases", () => {
    it("returns existing cases without calling the LLM or executor", async () => {
      const existing = [{ input: "1", referenceOutput: "1", kind: "normal", hidden: false }];
      mockFindOne.mockResolvedValue({ _id: QID, questionText: "Q", modelAnswer: "print(1)", evalCases: existing });
      const cases = await svc.ensureEvalCases(QID);
      expect(cases).toEqual(existing);
      expect(mockClient.messages.create).not.toHaveBeenCalled();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("generates, oracle-runs, drops empty-output cases, and persists", async () => {
      mockFindOne.mockResolvedValue({ _id: QID, questionText: "Echo", modelAnswer: "print(input())", evalCases: [] });
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify([{ input: "a", kind: "normal" }, { input: "b", kind: "edge" }, { input: "c", kind: "normal" }]) }],
      });
      mockExecute.mockResolvedValue(execResult([{ actualOutput: "A" }, { actualOutput: "   " }, { actualOutput: "C" }]));
      const cases = await svc.ensureEvalCases(QID);
      expect(cases).toHaveLength(2);
      expect(cases.map((c) => c.input)).toEqual(["a", "c"]);
      expect(mockUpdateOne).toHaveBeenCalledOnce();
    });
  });

  describe("evaluate", () => {
    it("marks logically-correct code correct even when output differs cosmetically", async () => {
      const existing = [{ input: "3\n7", referenceOutput: "7\n3", kind: "normal", hidden: false }];
      mockFindOne.mockResolvedValue({ _id: QID, questionText: "Swap", modelAnswer: "print(1)", evalCases: existing });
      // Student adds label text → NOT an exact match, but logic is correct.
      mockExecute.mockResolvedValue(execResult([{ actualOutput: "a=7\nb=3" }]));
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ correct: true, correctnessScore: 1, summary: "Correct.", strengths: ["Swaps values"], gaps: [], likelyComplete: true }) }],
      });

      const r = await svc.evaluate({ questionId: QID, questionText: "Swap", submittedCode: "...", modelAnswer: "print(1)" });

      expect(r.correct).toBe(true);
      expect(r.correctnessScore).toBe(1);
      expect(r.analysis.summary).toBe("Correct.");
      expect(r.analysis.matched).toEqual(["Swaps values"]);
      expect(r.analysis.gaps).toHaveLength(0);
      // Exact-match evidence is false, but the logical verdict is what counts.
      expect(r.results[0].matched).toBe(false);
    });

    it("works with no eval cases — the judge marks by reading the code", async () => {
      mockFindOne.mockResolvedValue({ _id: QID, questionText: "Q", modelAnswer: "m", evalCases: [] });
      mockClient.messages.create
        .mockResolvedValueOnce({ content: [{ type: "text", text: "not-an-array" }] }) // generateInputs → []
        .mockResolvedValueOnce({
          content: [{ type: "text", text: JSON.stringify({ correct: true, correctnessScore: 1, summary: "Good.", strengths: [], gaps: [], likelyComplete: true }) }],
        });

      const r = await svc.evaluate({ questionId: QID, questionText: "Q", submittedCode: "code", modelAnswer: "m" });

      expect(r.results).toHaveLength(0);
      expect(r.correct).toBe(true);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("falls back to execution evidence when the judge response is malformed", async () => {
      const existing = [
        { input: "1", referenceOutput: "1", kind: "normal", hidden: false },
        { input: "2", referenceOutput: "2", kind: "normal", hidden: false },
      ];
      mockFindOne.mockResolvedValue({ _id: QID, questionText: "Q", modelAnswer: "m", evalCases: existing });
      mockExecute.mockResolvedValue(execResult([{ actualOutput: "1" }, { actualOutput: "1" }])); // 1 of 2 exact
      mockClient.messages.create.mockResolvedValue({ content: [{ type: "text", text: "garbage" }] });

      const r = await svc.evaluate({ questionId: QID, questionText: "Q", submittedCode: "code", modelAnswer: "m" });

      expect(r.correct).toBe(false);
      expect(r.correctnessScore).toBe(0.5);
      expect(r.analysis.summary).toBe("Automated analysis unavailable.");
    });
  });
});
