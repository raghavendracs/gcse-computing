import { type ExecuteInput, type ExecuteOutput } from "./models";

class CodeExecutionService {
  private sandboxUrl: string;

  constructor() {
    this.sandboxUrl = process.env.PYTHON_SANDBOX_URL ?? "http://localhost:8000";
  }

  async execute(input: ExecuteInput): Promise<ExecuteOutput> {
    const { code, testCases, timeoutMs = 5000 } = input;

    try {
      const response = await fetch(`${this.sandboxUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          testCases: testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
          })),
          timeoutMs,
        }),
        signal: AbortSignal.timeout(timeoutMs + 2000),
      });

      if (!response.ok) {
        throw new Error(`Sandbox error: ${response.status}`);
      }

      const data = await response.json();

      return {
        testResults: data.testResults.map((r: any, i: number) => ({
          input: r.input,
          expectedOutput: r.expectedOutput,
          actualOutput: r.actualOutput,
          passed: r.passed,
          hidden: testCases[i]?.hidden ?? false,
        })),
        stderr: data.stderr ?? "",
        executionTimeMs: data.executionTimeMs ?? 0,
        timedOut: data.timedOut ?? false,
        blocked: data.blocked ?? false,
        blockReason: data.blockReason ?? null,
        executionPath: "sandbox",
      };
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof DOMException && err.name === "TimeoutError");
      if (!isNetworkError) throw err;

      // Sandbox unreachable — return AI fallback shape (all failed, unknown output)
      return {
        testResults: testCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: "",
          passed: false,
          hidden: tc.hidden,
        })),
        stderr: "",
        executionTimeMs: 0,
        timedOut: false,
        blocked: false,
        blockReason: null,
        executionPath: "ai",
      };
    }
  }
}

export default CodeExecutionService;
