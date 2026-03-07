import { describe, it, expect, vi, beforeEach } from "vitest";
import HintGenerationService from "../index";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

import Anthropic from "@anthropic-ai/sdk";

describe("HintGenerationService", () => {
  let svc: HintGenerationService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new HintGenerationService();
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("returns a hint for level 1", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "Think about what you need to track before the loop." }],
    });

    const result = await svc.generateHint({
      questionText: "Write a loop that sums 5 numbers.",
      submittedCode: "for i in range(5):\n    pass",
      hintLevel: 1,
      modelId: "claude-haiku-4-5-20251001",
    });

    expect(result.hintText).toBeTruthy();
    expect(result.hintLevel).toBe(1);
    expect(result.isLastHint).toBe(false);
  });

  it("marks hint 5 as last hint", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "Your structure should be: total = 0, for loop, print after." }],
    });

    const result = await svc.generateHint({
      questionText: "Q",
      submittedCode: "pass",
      hintLevel: 5,
      modelId: "claude-haiku-4-5-20251001",
    });

    expect(result.isLastHint).toBe(true);
  });

  it("strips leading whitespace and formatting from hint", async () => {
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "  Hint: Think about loops.  " }],
    });

    const result = await svc.generateHint({
      questionText: "Q",
      submittedCode: "pass",
      hintLevel: 2,
      modelId: "claude-haiku-4-5-20251001",
    });

    expect(result.hintText).toBe("Hint: Think about loops.");
  });
});
