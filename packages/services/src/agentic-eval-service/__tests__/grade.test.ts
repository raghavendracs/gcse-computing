import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks so they are available when vi.mock factories run
const mockFindOne = vi.hoisted(() => vi.fn());
const mockUpdateOne = vi.hoisted(() => vi.fn());
const mockExecute = vi.hoisted(() => vi.fn());

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

// Mock @gcse/database
vi.mock("@gcse/database", () => ({
  Question: {
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
  },
}));

// Mock CodeExecutionService (path resolves from this test file → src/code-execution-service)
vi.mock("../../code-execution-service", () => ({
  default: vi.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

import Anthropic from "@anthropic-ai/sdk";
import AgenticEvalService from "../index";

describe("AgenticEvalService", () => {
  let svc: AgenticEvalService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AgenticEvalService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("ensureEvalCases returns existing cases without calling LLM when evalCases is non-empty", async () => {
    const existingCases = [
      { input: "5", referenceOutput: "25", kind: "normal", hidden: false },
      { input: "0", referenceOutput: "0", kind: "edge", hidden: true },
    ];

    mockFindOne.mockResolvedValue({
      _id: "qid123",
      questionText: "Write a function that squares a number.",
      modelAnswer: "print(int(input()) ** 2)",
      evalCases: existingCases,
    });

    const result = await svc.ensureEvalCases("507f1f77bcf86cd799439011");

    expect(result).toEqual(existingCases);
    expect(mockClient.messages.create).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("ensureEvalCases generates, oracle-runs, persists cases — dropping inputs whose oracle output is empty", async () => {
    mockFindOne.mockResolvedValue({
      _id: "qid456",
      questionText: "Write a program that prints the square of a number.",
      modelAnswer: "print(int(input()) ** 2)",
      evalCases: [],
    });

    // LLM returns 3 inputs (normal, edge, edge — the last one will produce empty/whitespace output)
    const generatedInputs = [
      { input: "5", kind: "normal" },
      { input: "0", kind: "edge" },
      { input: "-3", kind: "edge" },
    ];

    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(generatedInputs) }],
    });

    // Oracle run: first two produce output, third produces whitespace — should be dropped
    mockExecute.mockResolvedValue({
      testResults: [
        { input: "5", expectedOutput: "", actualOutput: "25", passed: false, hidden: false },
        { input: "0", expectedOutput: "", actualOutput: "0", passed: false, hidden: false },
        { input: "-3", expectedOutput: "", actualOutput: "   ", passed: false, hidden: false },
      ],
      stderr: "",
      executionTimeMs: 10,
      timedOut: false,
      blocked: false,
      blockReason: null,
      executionPath: "sandbox",
    });

    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await svc.ensureEvalCases("507f1f77bcf86cd799439011");

    // Should only have 2 cases — the whitespace-output one is dropped
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ input: "5", referenceOutput: "25", kind: "normal", hidden: false });
    expect(result[1]).toEqual({ input: "0", referenceOutput: "0", kind: "edge", hidden: true });

    // Verify updateOne was called and persisted evalCases exclude the dropped input
    expect(mockUpdateOne).toHaveBeenCalledOnce();
    const updateCall = mockUpdateOne.mock.calls[0];
    const persistedCases = updateCall[1].$set.evalCases;
    expect(persistedCases).toHaveLength(2);
    expect(persistedCases.every((c: any) => c.input !== "-3")).toBe(true);
  });

  it("gradeSubmission returns correct matched/total given a stubbed execute result", async () => {
    const existingCases = [
      { input: "5", referenceOutput: "25", kind: "normal", hidden: false },
      { input: "0", referenceOutput: "0", kind: "edge", hidden: true },
      { input: "3", referenceOutput: "9", kind: "normal", hidden: false },
    ];

    mockFindOne.mockResolvedValue({
      _id: "qid789",
      questionText: "Write a program that squares a number.",
      modelAnswer: "print(int(input()) ** 2)",
      evalCases: existingCases,
    });

    // Student code passes 2 out of 3 tests
    mockExecute.mockResolvedValue({
      testResults: [
        { input: "5", expectedOutput: "25", actualOutput: "25", passed: true, hidden: false },
        { input: "0", expectedOutput: "0", actualOutput: "1", passed: false, hidden: true },
        { input: "3", expectedOutput: "9", actualOutput: "9", passed: true, hidden: false },
      ],
      stderr: "",
      executionTimeMs: 8,
      timedOut: false,
      blocked: false,
      blockReason: null,
      executionPath: "sandbox",
    });

    const result = await svc.gradeSubmission({
      questionId: "507f1f77bcf86cd799439011",
      code: "n = int(input())\nprint(n * n)",
    });

    expect(result.total).toBe(3);
    expect(result.matched).toBe(2);
    expect(result.results).toHaveLength(3);
    expect(result.results[0]).toEqual({
      input: "5",
      referenceOutput: "25",
      studentOutput: "25",
      matched: true,
      kind: "normal",
      hidden: false,
    });
    expect(result.results[1]).toEqual({
      input: "0",
      referenceOutput: "0",
      studentOutput: "1",
      matched: false,
      kind: "edge",
      hidden: true,
    });
    expect(result.results[2]).toEqual({
      input: "3",
      referenceOutput: "9",
      studentOutput: "9",
      matched: true,
      kind: "normal",
      hidden: false,
    });
  });
});
