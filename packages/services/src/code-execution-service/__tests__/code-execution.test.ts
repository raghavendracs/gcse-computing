import { describe, it, expect, vi, beforeEach } from "vitest";
import CodeExecutionService from "../index";

// Mock node fetch
vi.mock("node:http", () => ({}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const sandboxSuccess = {
  testResults: [
    { input: "5", expectedOutput: "25", actualOutput: "25", passed: true },
    { input: "0", expectedOutput: "0", actualOutput: "0", passed: true },
  ],
  stdout: "",
  stderr: "",
  executionTimeMs: 12,
  timedOut: false,
  blocked: false,
  blockReason: null,
};

describe("CodeExecutionService", () => {
  let svc: CodeExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PYTHON_SANDBOX_URL = "http://localhost:8000";
    svc = new CodeExecutionService();
  });

  it("calls sandbox and returns results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => sandboxSuccess,
    });

    const result = await svc.execute({
      code: "print(int(input()) ** 2)",
      testCases: [
        { input: "5", expectedOutput: "25", hidden: false },
        { input: "0", expectedOutput: "0", hidden: false },
      ],
    });

    expect(result.executionPath).toBe("sandbox");
    expect(result.testResults[0].passed).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.testResults[0].hidden).toBe(false);
    expect(result.testResults[1].hidden).toBe(false);
  });

  it("falls back to AI result shape when sandbox unreachable", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await svc.execute({
      code: "print(1)",
      testCases: [{ input: "", expectedOutput: "1", hidden: false }],
    });

    expect(result.executionPath).toBe("ai");
    // AI fallback returns all tests as unknown/failed
    expect(result.testResults[0].passed).toBe(false);
  });

  it("returns blocked result when sandbox says blocked", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...sandboxSuccess,
        testResults: [{ input: "", expectedOutput: "", actualOutput: "", passed: false }],
        blocked: true,
        blockReason: "import os",
      }),
    });

    const result = await svc.execute({
      code: "import os",
      testCases: [{ input: "", expectedOutput: "", hidden: false }],
    });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("import os");
  });
});
