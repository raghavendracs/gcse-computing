# Phase 3 — Coding Practice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full coding practice loop — Python sandbox container, CodeMirror editor, AI-powered dynamic hints, and AI marking — so students can write and run real Python code against test cases.

**Architecture:** A new FastAPI Python microservice (`apps/python-sandbox`) runs student code in a subprocess with safety limits; the API calls it via HTTP through `code-execution-service`; `coding-assessment-service` and `hint-generation-service` call the Anthropic API for marking and dynamic hints; a new `/modules/[id]/coding` page hosts the CodeMirror editor.

**Tech Stack:** FastAPI + Python 3.12, `@codemirror/lang-python`, `@codemirror/view`, Vitest, pytest, existing tRPC/Mongoose/Anthropic stack.

---

## Codebase Orientation

```
gcse-coding/
├── apps/
│   ├── api/src/index.ts              ← Express entry (add PYTHON_SANDBOX_URL env)
│   └── python-sandbox/               ← NEW FastAPI microservice
├── packages/
│   ├── services/src/
│   │   ├── code-execution-service/   ← NEW: HTTP client to sandbox + AI fallback
│   │   ├── coding-assessment-service/← NEW: AI marks code + execution results
│   │   ├── hint-generation-service/  ← NEW: dynamic AI hints based on student code
│   │   ├── question-generation-service/index.ts ← EXTEND: add coding question generation
│   │   └── index.ts                  ← add new service exports
│   └── trpc/src/server/
│       └── routes/questions/
│           ├── models.ts             ← add runCode + requestCodingHint models
│           └── route.ts              ← add runCode + requestCodingHint procedures
├── apps/web/
│   ├── hooks/api/questions.tsx       ← add useRunCode, useRequestCodingHint
│   └── app/(dashboard)/modules/[id]/
│       ├── page.tsx                  ← enable Coding button
│       └── coding/page.tsx           ← NEW: CodeMirror editor + test panel
└── docker-compose.yml                ← add python-sandbox service
```

**Pattern rules (must follow):**
- Services instantiated at module level in route files: `const svc = new MyService()`
- Never add services to tRPC context — pass directly in route handlers
- `studentProcedure` from `../../trpc`
- Hooks: mutations return mutation object directly
- Test mocks: `vi.mock("@gcse/database", () => ({ ModelName: { findOne: vi.fn() } }))`
- No commits in this plan

---

## Task 1: Python sandbox microservice

**Files:**
- Create: `apps/python-sandbox/main.py`
- Create: `apps/python-sandbox/requirements.txt`
- Create: `apps/python-sandbox/Dockerfile`
- Create: `apps/python-sandbox/tests/test_execute.py`

**Step 1: Write the failing test**

Create `apps/python-sandbox/tests/test_execute.py`:
```python
import pytest
from fastapi.testclient import TestClient

def get_client():
    from main import app
    return TestClient(app)

def test_correct_output():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "print(int(input()) ** 2)",
        "testCases": [
            {"input": "5", "expectedOutput": "25"},
            {"input": "3", "expectedOutput": "9"},
        ],
        "timeoutMs": 5000,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["testResults"][0]["passed"] is True
    assert data["testResults"][1]["passed"] is True
    assert data["timedOut"] is False
    assert data["blocked"] is False

def test_wrong_output():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "print(int(input()) + 1)",
        "testCases": [{"input": "5", "expectedOutput": "25"}],
        "timeoutMs": 5000,
    })
    data = resp.json()
    assert data["testResults"][0]["passed"] is False
    assert data["testResults"][0]["actualOutput"] == "6"

def test_syntax_error():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "def broken(:\n    pass",
        "testCases": [{"input": "", "expectedOutput": ""}],
        "timeoutMs": 5000,
    })
    data = resp.json()
    assert data["testResults"][0]["passed"] is False
    assert data["stderr"] != ""

def test_blocked_import():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "import os\nprint(os.getcwd())",
        "testCases": [{"input": "", "expectedOutput": ""}],
        "timeoutMs": 5000,
    })
    data = resp.json()
    assert data["blocked"] is True
    assert data["blockReason"] is not None

def test_timeout():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "while True: pass",
        "testCases": [{"input": "", "expectedOutput": ""}],
        "timeoutMs": 500,
    })
    data = resp.json()
    assert data["timedOut"] is True
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/python-sandbox
pip install fastapi uvicorn httpx pytest
pytest tests/test_execute.py -v
```
Expected: `ModuleNotFoundError: No module named 'main'`

**Step 3: Create `requirements.txt`**

```
fastapi==0.115.0
uvicorn==0.30.6
```

**Step 4: Create `main.py`**

```python
import subprocess
import sys
import re
import json
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

BLOCKED_IMPORTS = {
    "os", "subprocess", "socket", "sys", "shutil", "pathlib",
    "importlib", "ctypes", "multiprocessing", "threading",
    "urllib", "http", "ftplib", "smtplib", "telnetlib",
}

class TestCase(BaseModel):
    input: str
    expectedOutput: str

class ExecuteRequest(BaseModel):
    code: str
    testCases: list[TestCase]
    timeoutMs: int = 5000

class TestResult(BaseModel):
    input: str
    expectedOutput: str
    actualOutput: str
    passed: bool

class ExecuteResponse(BaseModel):
    testResults: list[TestResult]
    stdout: str
    stderr: str
    executionTimeMs: int
    timedOut: bool
    blocked: bool
    blockReason: Optional[str] = None

def check_blocked_imports(code: str) -> Optional[str]:
    # Match: import os, import os.path, from os import ..., __import__("os")
    patterns = [
        r'^\s*import\s+(\w+)',
        r'^\s*from\s+(\w+)',
        r'__import__\s*\(\s*["\'](\w+)',
    ]
    for line in code.splitlines():
        for pattern in patterns:
            m = re.search(pattern, line)
            if m:
                mod = m.group(1)
                if mod in BLOCKED_IMPORTS:
                    return f"import {mod}"
    return None

def run_single_test(code: str, test_input: str, timeout_s: float) -> tuple[str, str, bool]:
    """Returns (stdout, stderr, timed_out)"""
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            input=test_input,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        return result.stdout.strip(), result.stderr.strip(), False
    except subprocess.TimeoutExpired:
        return "", "", True

@app.post("/execute", response_model=ExecuteResponse)
def execute(req: ExecuteRequest):
    import time

    # Safety check
    blocked = check_blocked_imports(req.code)
    if blocked:
        empty_results = [
            TestResult(
                input=tc.input,
                expectedOutput=tc.expectedOutput,
                actualOutput="",
                passed=False,
            )
            for tc in req.testCases
        ]
        return ExecuteResponse(
            testResults=empty_results,
            stdout="", stderr="",
            executionTimeMs=0,
            timedOut=False,
            blocked=True,
            blockReason=blocked,
        )

    timeout_s = req.timeoutMs / 1000
    results: list[TestResult] = []
    all_stderr = ""
    timed_out = False
    start = time.time()

    for tc in req.testCases:
        stdout, stderr, did_timeout = run_single_test(req.code, tc.input, timeout_s)
        if did_timeout:
            timed_out = True
            results.append(TestResult(
                input=tc.input,
                expectedOutput=tc.expectedOutput,
                actualOutput="",
                passed=False,
            ))
            break
        if stderr:
            all_stderr = stderr
        results.append(TestResult(
            input=tc.input,
            expectedOutput=tc.expectedOutput,
            actualOutput=stdout,
            passed=stdout == tc.expectedOutput.strip(),
        ))

    elapsed_ms = int((time.time() - start) * 1000)

    return ExecuteResponse(
        testResults=results,
        stdout="",
        stderr=all_stderr,
        executionTimeMs=elapsed_ms,
        timedOut=timed_out,
        blocked=False,
        blockReason=None,
    )

@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 5: Run tests to verify they pass**

```bash
cd apps/python-sandbox
pytest tests/test_execute.py -v
```
Expected: 5 tests pass.

**Step 6: Create `Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 7: Add to `docker-compose.yml`**

In `docker-compose.yml`, add this service after the `api` service block and add `PYTHON_SANDBOX_URL` to the api environment:

```yaml
  # ─── Python Sandbox ─────────────────────────────────────────────────────────
  python-sandbox:
    build:
      context: .
      dockerfile: apps/python-sandbox/Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      MAX_TIMEOUT_MS: 5000
```

Also add to the `api` service's `environment` block:
```yaml
      PYTHON_SANDBOX_URL: http://python-sandbox:8000
```

---

## Task 2: `code-execution-service`

**Files:**
- Create: `packages/services/src/code-execution-service/models.ts`
- Create: `packages/services/src/code-execution-service/index.ts`
- Create: `packages/services/src/code-execution-service/__tests__/code-execution.test.ts`

**Step 1: Write the failing test**

Create `packages/services/src/code-execution-service/__tests__/code-execution.test.ts`:
```typescript
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
  });

  it("falls back to AI result shape when sandbox unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

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
```

**Step 2: Run test to verify it fails**

```bash
cd packages/services && pnpm test
```
Expected: FAIL — `CodeExecutionService` not found.

**Step 3: Create `models.ts`**

Create `packages/services/src/code-execution-service/models.ts`:
```typescript
import { z } from "zod";

export const testCaseInput = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean(),
});

export const executeInput = z.object({
  code: z.string(),
  testCases: z.array(testCaseInput),
  timeoutMs: z.number().int().positive().default(5000),
});

export type ExecuteInput = z.infer<typeof executeInput>;

export const testResultOutput = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const executeOutput = z.object({
  testResults: z.array(testResultOutput),
  stderr: z.string(),
  executionTimeMs: z.number(),
  timedOut: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  executionPath: z.enum(["sandbox", "ai"]),
});

export type ExecuteOutput = z.infer<typeof executeOutput>;
```

**Step 4: Create `index.ts`**

Create `packages/services/src/code-execution-service/index.ts`:
```typescript
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
    } catch {
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
```

**Step 5: Run tests to verify they pass**

```bash
cd packages/services && pnpm test
```
Expected: all tests pass including the 3 new code-execution tests.

---

## Task 3: `coding-assessment-service`

**Files:**
- Create: `packages/services/src/coding-assessment-service/models.ts`
- Create: `packages/services/src/coding-assessment-service/index.ts`
- Create: `packages/services/src/coding-assessment-service/__tests__/coding-assessment.test.ts`

**Step 1: Write the failing test**

Create `packages/services/src/coding-assessment-service/__tests__/coding-assessment.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd packages/services && pnpm test
```
Expected: FAIL — `CodingAssessmentService` not found.

**Step 3: Create `models.ts`**

Create `packages/services/src/coding-assessment-service/models.ts`:
```typescript
import { z } from "zod";

const testResultSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const assessCodeInput = z.object({
  questionText: z.string(),
  submittedCode: z.string(),
  testResults: z.array(testResultSchema),
  markSchemePoints: z.array(z.string()),
  maxMarks: z.number().int().positive(),
  modelId: z.string(),
});

export type AssessCodeInput = z.infer<typeof assessCodeInput>;

export const assessCodeOutput = z.object({
  awardedMarks: z.number().int().min(0),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  syntaxValid: z.boolean(),
  errorCategory: z.enum(["syntax", "logic", "runtime"]).nullable(),
});

export type AssessCodeOutput = z.infer<typeof assessCodeOutput>;
```

**Step 4: Create `index.ts`**

Create `packages/services/src/coding-assessment-service/index.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { type AssessCodeInput, type AssessCodeOutput } from "./models";

class CodingAssessmentService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async assessCode(input: AssessCodeInput): Promise<AssessCodeOutput> {
    const { questionText, submittedCode, testResults, markSchemePoints, maxMarks, modelId } = input;

    const testSummary = testResults.length > 0
      ? testResults.map((r, i) =>
          `Test ${i + 1}: input="${r.input}" expected="${r.expectedOutput}" got="${r.actualOutput}" — ${r.passed ? "PASS" : "FAIL"}`
        ).join("\n")
      : "No test results available.";

    const systemPrompt = `You are a GCSE Computer Science examiner marking student Python code.
Output ONLY a JSON object with exactly these fields:
{
  "awardedMarks": 4,
  "feedback": "2-3 sentences of constructive feedback",
  "missingPoints": ["mark scheme point the student missed"],
  "strengths": ["what the student got right"],
  "confidence": 0.9,
  "syntaxValid": true,
  "errorCategory": null
}
Rules:
- awardedMarks: integer 0..maxMarks
- errorCategory: "syntax" | "logic" | "runtime" | null
- syntaxValid: true if code has no syntax errors
- confidence: 0.0..1.0`;

    const userPrompt = `Question: ${questionText}

Mark scheme (${maxMarks} marks):
${markSchemePoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Student code:
\`\`\`python
${submittedCode}
\`\`\`

Test execution results:
${testSummary}`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 600,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : content.text.trim();
    const parsed = JSON.parse(jsonStr);

    if (
      typeof parsed.awardedMarks !== "number" ||
      typeof parsed.feedback !== "string" ||
      !Array.isArray(parsed.missingPoints) ||
      !Array.isArray(parsed.strengths)
    ) {
      throw new Error("Invalid coding assessment response from AI");
    }

    return {
      awardedMarks: Math.max(0, Math.min(maxMarks, Math.round(parsed.awardedMarks))),
      feedback: parsed.feedback,
      missingPoints: parsed.missingPoints as string[],
      strengths: parsed.strengths as string[],
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.8)),
      syntaxValid: Boolean(parsed.syntaxValid),
      errorCategory: (["syntax", "logic", "runtime"].includes(parsed.errorCategory)
        ? parsed.errorCategory
        : null) as "syntax" | "logic" | "runtime" | null,
    };
  }
}

export default CodingAssessmentService;
```

**Step 5: Run tests to verify they pass**

```bash
cd packages/services && pnpm test
```
Expected: all tests pass including 3 new coding-assessment tests.

---

## Task 4: `hint-generation-service`

**Files:**
- Create: `packages/services/src/hint-generation-service/models.ts`
- Create: `packages/services/src/hint-generation-service/index.ts`
- Create: `packages/services/src/hint-generation-service/__tests__/hint-generation.test.ts`

**Step 1: Write the failing test**

Create `packages/services/src/hint-generation-service/__tests__/hint-generation.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd packages/services && pnpm test
```
Expected: FAIL — `HintGenerationService` not found.

**Step 3: Create `models.ts`**

Create `packages/services/src/hint-generation-service/models.ts`:
```typescript
import { z } from "zod";

const testResultSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
});

export const generateHintInput = z.object({
  questionText: z.string(),
  submittedCode: z.string(),
  hintLevel: z.number().int().min(1).max(5),
  testResults: z.array(testResultSchema).optional(),
  modelId: z.string(),
});

export type GenerateHintInput = z.infer<typeof generateHintInput>;

export const generateHintOutput = z.object({
  hintText: z.string(),
  hintLevel: z.number().int(),
  isLastHint: z.boolean(),
});

export type GenerateHintOutput = z.infer<typeof generateHintOutput>;
```

**Step 4: Create `index.ts`**

Create `packages/services/src/hint-generation-service/index.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { type GenerateHintInput, type GenerateHintOutput } from "./models";

const HINT_LEVEL_DESCRIPTIONS = [
  "very general — point toward the concept without mentioning the code structure",
  "slightly more specific — hint at the approach or algorithm",
  "more direct — describe the structure needed without giving code",
  "concrete — describe pseudocode or the key operation needed",
  "near-solution — provide structural scaffolding (pseudocode or partial structure). NEVER give the full working code answer.",
];

class HintGenerationService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateHint(input: GenerateHintInput): Promise<GenerateHintOutput> {
    const { questionText, submittedCode, hintLevel, testResults, modelId } = input;

    const levelDesc = HINT_LEVEL_DESCRIPTIONS[hintLevel - 1];

    const testContext = testResults && testResults.length > 0
      ? `\nTest results from their last run:\n${testResults
          .map((r, i) => `  Test ${i + 1}: ${r.passed ? "PASS" : "FAIL"} (got "${r.actualOutput}", expected "${r.expectedOutput}")`)
          .join("\n")}`
      : "";

    const systemPrompt = `You are a supportive GCSE Computer Science tutor giving a coding hint.
Generate a single hint that is ${levelDesc}.
Output ONLY the hint text — no labels, no "Hint:", no markdown formatting, no explanation.
The hint must be 1-2 sentences maximum.`;

    const userPrompt = `Question: ${questionText}

Student's current code:
\`\`\`python
${submittedCode || "(no code written yet)"}
\`\`\`
${testContext}

Generate hint ${hintLevel} of 5.`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 150,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    return {
      hintText: content.text.trim(),
      hintLevel,
      isLastHint: hintLevel === 5,
    };
  }
}

export default HintGenerationService;
```

**Step 5: Run tests to verify they pass**

```bash
cd packages/services && pnpm test
```
Expected: all tests pass including 3 new hint-generation tests.

---

## Task 5: Export new services + extend question generation for coding

**Files:**
- Modify: `packages/services/src/index.ts`
- Modify: `packages/services/src/question-generation-service/index.ts`

**Step 1: Export new services**

Update `packages/services/src/index.ts`:
```typescript
export { default as AuthService } from "./auth-service/index";
export { default as QuestionGenerationService } from "./question-generation-service/index";
export { default as TheoryMarkingService } from "./theory-marking-service/index";
export { default as CodeExecutionService } from "./code-execution-service/index";
export { default as CodingAssessmentService } from "./coding-assessment-service/index";
export { default as HintGenerationService } from "./hint-generation-service/index";
```

**Step 2: Extend question generation to support coding questions**

In `packages/services/src/question-generation-service/index.ts`, the `callAI` method currently always generates `answerFormat: "free_text"` questions. Extend it to detect coding templates and generate coding questions.

Find the `callAI` method signature and update the method plus the `generateQuestion` insert block:

Change the save block (around line 53) from:
```typescript
    const doc = await GeneratedQuestion.insertOne({
      ...
      answerFormat: "free_text",
      maxMarks: generated.maxMarks,
      markSchemePoints: generated.markSchemePoints,
      modelAnswer: generated.modelAnswer,
      hints: generated.hints,
      testCases: [],
```

To:
```typescript
    const isCoding = template?.questionType === "coding";

    const doc = await GeneratedQuestion.insertOne({
      moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
      templateId: template ? template._id : undefined,
      userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
      questionType: template?.questionType ?? "short_answer",
      difficulty,
      questionText: generated.questionText,
      answerFormat: isCoding ? "code" : "free_text",
      maxMarks: generated.maxMarks,
      markSchemePoints: generated.markSchemePoints,
      modelAnswer: generated.modelAnswer,
      hints: generated.hints,
      testCases: generated.testCases ?? [],
      metadata: {
        examBoard: examBoard ?? mod.examBoard,
        topicName: mod.topicName,
        misconceptionNotes: generated.misconceptionNotes,
      },
      usedInSession: false,
    });
```

Also update the `callAI` method to include `testCases` in its return type and the AI prompt to generate them for coding questions. Replace the `callAI` method entirely with:

```typescript
  private async callAI(
    mod: any,
    template: any | null,
    difficulty: string,
    examBoard: string | undefined,
    modelId: string,
  ): Promise<{
    questionText: string;
    maxMarks: number;
    markSchemePoints: string[];
    hints: string[];
    modelAnswer: string;
    misconceptionNotes: string[];
    testCases: { input: string; expectedOutput: string; hidden: boolean }[];
  }> {
    const isCoding = template?.questionType === "coding";

    const systemPrompt = isCoding
      ? `You are a GCSE Computer Science examiner. Generate Python coding questions in valid JSON only.
Output ONLY a JSON object with exactly these fields:
{
  "questionText": "the full question text",
  "maxMarks": 6,
  "testCases": [
    { "input": "5", "expectedOutput": "25", "hidden": false },
    { "input": "3", "expectedOutput": "9", "hidden": false },
    { "input": "-2", "expectedOutput": "4", "hidden": true }
  ],
  "markSchemePoints": ["point 1 per mark", ...],
  "modelAnswer": "def solution(n):\\n    return n * n",
  "hints": ["hint 1", "hint 2", "hint 3", "hint 4", "hint 5"],
  "misconceptionNotes": ["common mistake"]
}
Rules:
- testCases: minimum 2 visible (hidden: false) + 1 hidden (hidden: true)
- number of markSchemePoints must equal maxMarks
- hints: exactly 5, progressively more helpful; hint 5 is pseudocode/structure, never full solution
- modelAnswer: working Python code`
      : `You are a GCSE Computer Science examiner. Generate exam-style questions in valid JSON only.
Output ONLY a JSON object with exactly these fields:
{
  "questionText": "the question text",
  "maxMarks": 4,
  "markSchemePoints": ["point 1", "point 2", "..."],
  "hints": ["hint 1", "hint 2", "hint 3", "hint 4", "hint 5"],
  "modelAnswer": "full model answer",
  "misconceptionNotes": ["common mistake 1"]
}
Rules:
- hints must have exactly 5 items, progressively more helpful; hint 5 is near-solution scaffolding, never the full answer
- number of markSchemePoints must equal maxMarks (one point per mark)
- questionText must be self-contained and appropriate for ${difficulty} difficulty
- modelAnswer must address all mark scheme points`;

    const templateContext = template
      ? `Base template: "${template.promptTemplate}"
Key concepts: ${template.rubric.acceptedConcepts.join(", ")}
Common misconceptions to address in hints: ${template.rubric.commonMisconceptions.join(", ")}`
      : "";

    const userPrompt = `Generate a ${difficulty} ${isCoding ? "coding" : "short_answer"} question about "${mod.topicName}" for ${examBoard ?? mod.examBoard} GCSE.
${templateContext}
Max marks: ${template?.rubric.maxMarks ?? 4}`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    const jsonStr = content.text
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(jsonStr);

    if (
      typeof parsed.questionText !== "string" ||
      typeof parsed.maxMarks !== "number" ||
      !Array.isArray(parsed.markSchemePoints) ||
      !Array.isArray(parsed.hints) ||
      parsed.hints.length !== 5 ||
      typeof parsed.modelAnswer !== "string"
    ) {
      throw new Error("Invalid question structure from AI");
    }

    if (isCoding && (!Array.isArray(parsed.testCases) || parsed.testCases.length < 3)) {
      throw new Error("Invalid coding question: insufficient test cases from AI");
    }

    return {
      questionText: parsed.questionText,
      maxMarks: parsed.maxMarks,
      markSchemePoints: parsed.markSchemePoints,
      hints: parsed.hints,
      modelAnswer: parsed.modelAnswer,
      misconceptionNotes: Array.isArray(parsed.misconceptionNotes) ? parsed.misconceptionNotes : [],
      testCases: isCoding ? parsed.testCases : [],
    };
  }
```

**Step 3: Run all tests**

```bash
cd packages/services && pnpm test
```
Expected: all tests still pass.

**Step 4: Build services package**

```bash
cd packages/services && pnpm build
```
Expected: exits 0 with no TypeScript errors.

---

## Task 6: tRPC — `runCode` and `requestCodingHint` procedures

**Files:**
- Modify: `packages/trpc/src/server/routes/questions/models.ts`
- Modify: `packages/trpc/src/server/routes/questions/route.ts`

**Step 1: Add models**

In `packages/trpc/src/server/routes/questions/models.ts`, append:

```typescript
export const runCodeInputModel = z.object({
  questionId: z.string(),
  code: z.string(),
});

const testResultModel = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  hidden: z.boolean(),
});

export const runCodeOutputModel = z.object({
  testResults: z.array(testResultModel),
  stderr: z.string(),
  executionTimeMs: z.number(),
  timedOut: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  executionPath: z.enum(["sandbox", "ai"]),
});

export const requestCodingHintInputModel = z.object({
  questionId: z.string(),
  code: z.string(),
  currentHintLevel: z.number().int().min(0).max(4),
  testResults: z.array(testResultModel).optional(),
});

export const requestCodingHintOutputModel = z.object({
  hintText: z.string(),
  hintLevel: z.number(),
  isLastHint: z.boolean(),
});
```

**Step 2: Add procedures to route**

In `packages/trpc/src/server/routes/questions/route.ts`:

Add imports at top:
```typescript
import {
  CodeExecutionService,
  CodingAssessmentService,
  HintGenerationService,
} from "@gcse/services";
import {
  runCodeInputModel,
  runCodeOutputModel,
  requestCodingHintInputModel,
  requestCodingHintOutputModel,
} from "./models";
```

Add service instantiations after existing ones:
```typescript
const codeExecSvc = new CodeExecutionService();
const codingAssessmentSvc = new CodingAssessmentService();
const hintGenSvc = new HintGenerationService();
```

Extend `submitAnswer` to handle coding questions — replace the marking call section:

Find the line:
```typescript
      const assessment = await markingSvc.markAnswer({
```

And replace the entire marking block with:
```typescript
      let assessmentResult: {
        awardedMarks: number;
        maxMarks: number;
        feedback: string;
        missingPoints: string[];
        strengths: string[];
        confidence: number;
      };
      let codingAnalysis: {
        syntaxValid: boolean;
        testsPassed: number;
        testsFailed: number;
        errorCategory: "syntax" | "logic" | "runtime" | null;
        executionPath: "sandbox" | "ai";
      } | undefined;

      if (question.answerFormat === "code") {
        // Run code to get test results for context
        const execResult = await codeExecSvc.execute({
          code: input.answer,
          testCases: question.testCases,
          timeoutMs: 5000,
        });

        const modelId = await questionGenSvc.resolveModelForUser(ctx.user!.userId);
        const aiAssessment = await codingAssessmentSvc.assessCode({
          questionText: question.questionText,
          submittedCode: input.answer,
          testResults: execResult.testResults,
          markSchemePoints: question.markSchemePoints,
          maxMarks: question.maxMarks,
          modelId,
        });

        assessmentResult = {
          awardedMarks: aiAssessment.awardedMarks,
          maxMarks: question.maxMarks,
          feedback: aiAssessment.feedback,
          missingPoints: aiAssessment.missingPoints,
          strengths: aiAssessment.strengths,
          confidence: aiAssessment.confidence,
        };
        codingAnalysis = {
          syntaxValid: aiAssessment.syntaxValid,
          testsPassed: execResult.testResults.filter((r) => r.passed).length,
          testsFailed: execResult.testResults.filter((r) => !r.passed).length,
          errorCategory: aiAssessment.errorCategory,
          executionPath: execResult.executionPath,
        };
      } else {
        const marking = await markingSvc.markAnswer({
          questionText: question.questionText,
          markSchemePoints: question.markSchemePoints,
          submittedAnswer: input.answer,
          maxMarks: question.maxMarks,
        });
        assessmentResult = {
          awardedMarks: marking.awardedMarks,
          maxMarks: question.maxMarks,
          feedback: marking.feedback,
          missingPoints: marking.missingPoints,
          strengths: marking.strengths,
          confidence: marking.confidence,
        };
      }
```

Also update the `QuestionAttempt.insertOne` call to include `codingAnalysis` and set `submissionType` correctly:
```typescript
      const attempt = await QuestionAttempt.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        attemptNumber: priorCount + 1,
        submittedAnswer: input.answer,
        submissionType: question.answerFormat === "code" ? "code" : "text",
        assessment: assessmentResult,
        codingAnalysis,
        hintsUsedCount: input.hintsUsed,
        timeSpentSeconds: input.timeSpentSeconds,
      });
```

Add the two new procedures to the `questionsRouter` object:

```typescript
  runCode: studentProcedure
    .input(runCodeInputModel)
    .output(runCodeOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      return codeExecSvc.execute({
        code: input.code,
        testCases: question.testCases,
        timeoutMs: 5000,
      });
    }),

  requestCodingHint: studentProcedure
    .input(requestCodingHintInputModel)
    .output(requestCodingHintOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user!.userId) },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const nextLevel = input.currentHintLevel + 1;
      if (nextLevel > 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No more hints available" });
      }

      const modelId = await questionGenSvc.resolveModelForUser(ctx.user!.userId);

      const hint = await hintGenSvc.generateHint({
        questionText: question.questionText,
        submittedCode: input.code,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        testResults: input.testResults,
        modelId,
      });

      await HintEvent.insertOne({
        userId: new Types.ObjectId(ctx.user!.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        hintText: hint.hintText,
        requestedAt: new Date(),
      });

      return hint;
    }),
```

**Step 3: Expose `resolveModelForUser` on `QuestionGenerationService`**

In `packages/services/src/question-generation-service/index.ts`, the `resolveModel` private method needs to be accessible from the route. Change it from `private` to `public` and rename it:

```typescript
  public async resolveModelForUser(userId: string): Promise<string> {
```

(Just change `private async resolveModel` to `public async resolveModelForUser` and update its call at line ~47 from `this.resolveModel(userId)` to `this.resolveModelForUser(userId)`.)

**Step 4: Build trpc package**

```bash
cd packages/trpc && pnpm build
```
Expected: exits 0 with no TypeScript errors.

---

## Task 7: Frontend — hooks + CodeMirror install

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/hooks/api/questions.tsx`

**Step 1: Install CodeMirror**

```bash
cd apps/web
pnpm add @codemirror/view @codemirror/state @codemirror/lang-python @codemirror/theme-one-dark codemirror
```

Expected: packages added to `apps/web/package.json`.

**Step 2: Add hooks**

In `apps/web/hooks/api/questions.tsx`, append:

```typescript
export const useRunCode = () => {
  return trpc.questions.runCode.useMutation();
};

export const useRequestCodingHint = () => {
  return trpc.questions.requestCodingHint.useMutation();
};
```

**Step 3: Verify build**

```bash
cd apps/web && pnpm build
```
Expected: compiles with no TypeScript errors.

---

## Task 8: Coding practice page

**Files:**
- Create: `apps/web/app/(dashboard)/modules/[id]/coding/page.tsx`

**Step 1: Create the page**

Create `apps/web/app/(dashboard)/modules/[id]/coding/page.tsx`:

```tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useGenerateQuestion, useSubmitAnswer, useRunCode, useRequestCodingHint } from "~/hooks/api/questions";
import { useEndSession } from "~/hooks/api/sessions";
import dynamic from "next/dynamic";

// CodeMirror must be client-only (no SSR)
const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });

type Question = {
  id: string;
  questionText: string;
  maxMarks: number;
  modelAnswer: string;
  testCases: { input: string; expectedOutput: string; hidden: boolean }[];
  metadata: { topicName: string; examBoard: string };
};

type TestResult = {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  hidden: boolean;
};

type Assessment = {
  awardedMarks: number;
  maxMarks: number;
  feedback: string;
  missingPoints: string[];
  strengths: string[];
};

export default function CodingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const moduleId = params.id as string;
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState("# Write your Python solution here\n");
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [runError, setRunError] = useState("");
  const [hintsRevealed, setHintsRevealed] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modelAnswer, setModelAnswer] = useState("");
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQuestion = useGenerateQuestion();
  const submitAnswer = useSubmitAnswer();
  const runCode = useRunCode();
  const requestCodingHint = useRequestCodingHint();
  const endSession = useEndSession();

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimeSpent((t) => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const loadQuestion = useCallback(async () => {
    setCode("# Write your Python solution here\n");
    setTestResults(null);
    setRunError("");
    setHintsRevealed([]);
    setShowHints(true);
    setAssessment(null);
    setShowModelAnswer(false);
    setModelAnswer("");
    setError("");
    setTimeSpent(0);
    stopTimer();

    try {
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium" });
      setQuestion(q as unknown as Question);
      startTimer();
    } catch {
      setError("Failed to load question. Please try again.");
    }
  }, [moduleId, generateQuestion, startTimer, stopTimer]);

  useEffect(() => {
    loadQuestion();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const handleRun = async () => {
    if (!question || !code.trim()) return;
    setRunError("");
    try {
      const result = await runCode.mutateAsync({ questionId: question.id, code });
      setTestResults(result.testResults as TestResult[]);
      if (result.blocked) {
        setRunError(`Restricted: \`${result.blockReason}\` is not allowed in GCSE practice.`);
        setTestResults(null);
      } else if (result.timedOut) {
        setRunError("Code took too long — check for infinite loops.");
        setTestResults(null);
      } else if (result.stderr) {
        setRunError(result.stderr.split("\n").slice(-2).join(" "));
      }
    } catch {
      setError("Run failed. Please try again.");
    }
  };

  const handleHint = async () => {
    if (!question || hintsRevealed.length >= 5) return;
    try {
      const { hintText } = await requestCodingHint.mutateAsync({
        questionId: question.id,
        code,
        currentHintLevel: hintsRevealed.length,
        testResults: testResults ?? undefined,
      });
      setHintsRevealed((prev) => [...prev, hintText]);
      setShowHints(true);
    } catch {
      setError("Could not load hint.");
    }
  };

  const handleSubmit = async () => {
    if (!question || !code.trim()) return;
    stopTimer();
    try {
      const result = await submitAnswer.mutateAsync({
        questionId: question.id,
        sessionId,
        answer: code,
        hintsUsed: hintsRevealed.length,
        timeSpentSeconds: timeSpent,
      });
      setAssessment(result.assessment);
      setModelAnswer(result.modelAnswer);
    } catch {
      setError("Submission failed. Please try again.");
      startTimer();
    }
  };

  const handleEndSession = async () => {
    try {
      if (sessionId) await endSession.mutateAsync({ sessionId });
    } finally {
      router.push("/dashboard");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (generateQuestion.isPending && !question) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-24 bg-slate-200 rounded" />
        <div className="h-48 bg-slate-200 rounded" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="max-w-2xl text-center py-16">
        <p className="text-slate-500">{error}</p>
        <button onClick={loadQuestion} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Coding Practice</p>
          <p className="text-sm text-slate-500">{question?.metadata.topicName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 tabular-nums">{formatTime(timeSpent)}</span>
          <button onClick={handleEndSession} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            End session
          </button>
        </div>
      </div>

      {question && (
        <>
          {/* Question */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Question</span>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                {question.maxMarks} {question.maxMarks === 1 ? "mark" : "marks"}
              </span>
            </div>
            <p className="text-slate-800 leading-relaxed">{question.questionText}</p>
          </div>

          {/* Hints */}
          {hintsRevealed.length > 0 && (
            <div className="mb-4 space-y-2">
              <button
                onClick={() => setShowHints((v) => !v)}
                className="flex items-center justify-between w-full text-left px-1"
              >
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Hints ({hintsRevealed.length})
                </span>
                <span className="text-xs text-amber-500">{showHints ? "▲" : "▼"}</span>
              </button>
              {showHints && hintsRevealed.map((hint, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <span className="text-xs font-semibold text-amber-700 mr-2">Hint {i + 1}</span>
                  <span className="text-sm text-amber-800">{hint}</span>
                </div>
              ))}
            </div>
          )}

          {!assessment ? (
            <>
              {/* Code editor */}
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200">
                <CodeEditor
                  value={code}
                  onChange={(val) => { setCode(val); setShowHints(false); }}
                />
              </div>

              {/* Run error */}
              {runError && (
                <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-rose-700 mb-1">Error</p>
                  <p className="text-sm text-rose-800 font-mono whitespace-pre-wrap">{runError}</p>
                </div>
              )}

              {/* Test results */}
              {testResults && (
                <div className="mb-4 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mb-2">
                    Test Results — {testResults.filter((r) => r.passed).length}/{testResults.length} passed
                  </p>
                  {testResults.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-4 py-2.5 border text-sm font-mono ${
                        r.passed
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-rose-50 border-rose-200"
                      }`}
                    >
                      <span className={`font-semibold mr-2 ${r.passed ? "text-emerald-700" : "text-rose-700"}`}>
                        {r.passed ? "✓" : "✗"}
                      </span>
                      {r.hidden ? (
                        <span className="text-slate-500">Hidden test</span>
                      ) : (
                        <>
                          <span className="text-slate-600">input: </span>
                          <span className="text-slate-800">{r.input || "(none)"}</span>
                          {!r.passed && (
                            <>
                              <span className="text-slate-400 mx-2">·</span>
                              <span className="text-slate-600">expected: </span>
                              <span className="text-emerald-700">{r.expectedOutput}</span>
                              <span className="text-slate-400 mx-2">·</span>
                              <span className="text-slate-600">got: </span>
                              <span className="text-rose-700">{r.actualOutput || "(no output)"}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRun}
                  disabled={runCode.isPending || !code.trim()}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runCode.isPending ? "Running..." : "Run ▶"}
                </button>

                <button
                  onClick={handleHint}
                  disabled={requestCodingHint.isPending || hintsRevealed.length >= 5}
                  className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestCodingHint.isPending
                    ? "Loading..."
                    : hintsRevealed.length === 0
                      ? "Get hint"
                      : hintsRevealed.length < 5
                        ? `Hint ${hintsRevealed.length + 1} of 5`
                        : "No more hints"}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitAnswer.isPending || !code.trim()}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitAnswer.isPending ? "Marking..." : "Submit →"}
                </button>
              </div>
            </>
          ) : (
            /* Feedback panel */
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`text-3xl font-bold ${
                      assessment.awardedMarks === assessment.maxMarks
                        ? "text-emerald-600"
                        : assessment.awardedMarks >= assessment.maxMarks / 2
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {assessment.awardedMarks}/{assessment.maxMarks}
                  </div>
                  <span className="text-sm text-slate-500">marks awarded</span>
                  {hintsRevealed.length > 0 && (
                    <span className="ml-auto text-xs text-slate-400">
                      {hintsRevealed.length} hint{hintsRevealed.length > 1 ? "s" : ""} used
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{assessment.feedback}</p>
              </div>

              {assessment.strengths.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">What you got right</p>
                  <ul className="space-y-1">
                    {assessment.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-800 flex gap-2"><span>✓</span><span>{s}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {assessment.missingPoints.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">Missing points</p>
                  <ul className="space-y-1">
                    {assessment.missingPoints.map((p, i) => (
                      <li key={i} className="text-sm text-rose-800 flex gap-2"><span>✗</span><span>{p}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Your submitted code */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your code</p>
                <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{code}</pre>
              </div>

              {/* Model answer toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <button
                  onClick={() => setShowModelAnswer((v) => !v)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {showModelAnswer ? "Hide model answer ▲" : "Show model answer ▼"}
                </button>
                {showModelAnswer && (
                  <pre className="mt-3 text-sm text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                    {modelAnswer}
                  </pre>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={loadQuestion}
                  disabled={generateQuestion.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generateQuestion.isPending ? "Loading..." : "Next question →"}
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  End session
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Create the CodeEditor component**

Create `apps/web/app/(dashboard)/modules/[id]/coding/CodeEditor.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function CodeEditor({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        python(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { minHeight: "200px", fontSize: "14px" },
        }),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. loadQuestion resets code)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="w-full" />;
}
```

**Step 3: Build**

```bash
cd apps/web && pnpm build
```
Expected: compiles with no TypeScript errors.

---

## Task 9: Enable Coding button on module detail page

**Files:**
- Modify: `apps/web/app/(dashboard)/modules/[id]/page.tsx`

**Step 1: Update `handleStart` and enable Coding button**

In `apps/web/app/(dashboard)/modules/[id]/page.tsx`:

Change the `handleStart` function signature:
```typescript
  const handleStart = async (mode: "theory" | "coding") => {
    const { sessionId } = await startSession.mutateAsync({ moduleId, mode });
    const path = mode === "coding" ? "coding" : "practice";
    router.push(`/modules/${moduleId}/${path}?sessionId=${sessionId}&mode=${mode}`);
  };
```

Replace the "Coding — coming in Phase 3" disabled div with an active button:
```tsx
          {/* Coding — active */}
          <button
            onClick={() => handleStart("coding")}
            disabled={startSession.isPending}
            className="flex flex-col items-start p-5 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
          >
            <span className="text-2xl mb-2">💻</span>
            <span className="font-semibold text-slate-900">Coding</span>
            <span className="text-xs text-slate-500 mt-1">Python programming questions</span>
          </button>
```

**Step 2: Build**

```bash
cd apps/web && pnpm build
```
Expected: no errors.

---

## Task 10: Add coding templates to seed + full rebuild

**Files:**
- Modify: `apps/api/src/seed/templates.ts` (verify coding templates exist — they already do from the existing seed)

**Step 1: Verify coding templates in seed**

Run:
```bash
grep -c '"coding"' apps/api/src/seed/templates.ts
```
Expected: count > 0 (at least 2 coding templates already seeded).

If count is 0, add to `apps/api/src/seed/templates.ts`:
```typescript
  {
    moduleCode: "PROG-01",
    questionType: "coding",
    templateName: "FizzBuzz variant",
    promptTemplate: "Write a Python function that takes a number n and returns 'Fizz' if divisible by 3, 'Buzz' if divisible by 5, 'FizzBuzz' if both, otherwise the number as a string.",
    generationRules: { parameters: ["divisors"], difficulty: "medium" },
    rubric: {
      maxMarks: 4,
      markSchemePoints: [
        "Function accepts a parameter n",
        "Checks divisibility by both 3 and 5 first (FizzBuzz case)",
        "Correctly returns 'Fizz', 'Buzz', or 'FizzBuzz'",
        "Returns str(n) for non-matching numbers",
      ],
      acceptedConcepts: ["if", "elif", "else", "modulo", "return", "str"],
      commonMisconceptions: [
        "Checking individual conditions before combined condition",
        "Forgetting to convert n to string for the default case",
      ],
    },
    hintFramework: [
      "Think about the order your conditions need to be checked — which case is most specific?",
      "The modulo operator % gives you the remainder. If n % 3 == 0, what does that mean?",
      "You need to check if n is divisible by BOTH 3 and 5 — this should be your first elif.",
      "Structure: def fizzbuzz(n): if n%3==0 and n%5==0: ... elif n%3==0: ... elif n%5==0: ... else: ...",
      "Your function should be: def fizzbuzz(n): if n%3==0 and n%5==0: return 'FizzBuzz' elif n%3==0: return 'Fizz' elif n%5==0: return 'Buzz' else: return str(n)",
    ],
    modelAnswerTemplate: "def fizzbuzz(n):\n    if n % 3 == 0 and n % 5 == 0:\n        return 'FizzBuzz'\n    elif n % 3 == 0:\n        return 'Fizz'\n    elif n % 5 == 0:\n        return 'Buzz'\n    else:\n        return str(n)",
  },
```

**Step 2: Run all tests**

```bash
pnpm test
```
Expected: all tests pass (16+ tests).

**Step 3: Full Docker rebuild**

```bash
docker compose down && docker compose up --build -d
```
Expected: 4 containers start (mongodb, api, web, python-sandbox).

Verify:
```bash
docker compose ps
```
Expected: all 4 containers show `running`.

**Step 4: Smoke test sandbox**

```bash
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok"}`

```bash
curl -s -X POST http://localhost:8000/execute \
  -H "Content-Type: application/json" \
  -d '{"code":"print(int(input())**2)","testCases":[{"input":"5","expectedOutput":"25"}],"timeoutMs":5000}'
```
Expected: `{"testResults":[{"input":"5","expectedOutput":"25","actualOutput":"25","passed":true}],...}`

---

## Task 11: End-to-end browser smoke test

**Step 1:** Open `http://localhost:3000` and sign in as a student.

**Step 2:** Click any module card → verify the "Coding" button is now active (green border, not greyed out).

**Step 3:** Click **Coding** → verify navigation to `/modules/[id]/coding?sessionId=...` and a coding question loads with a CodeMirror editor.

**Step 4:** Type valid Python:
```python
print(int(input()) ** 2)
```
Click **Run ▶** → verify test results panel appears with ✓/✗ per visible test case.

**Step 5:** Click **Get hint** → verify a hint appears above the editor.

**Step 6:** Click **Submit →** → verify assessment panel (marks, strengths, missing points).

**Step 7:** Click **Show model answer ▼** → verify Python code appears.

**Step 8:** Click **Next question →** → verify editor resets and new question loads.

**Step 9:** Click **End session** → verify redirect to dashboard.

**Step 10:** Test error cases:
- Type `import os` and **Run** → verify blocked import message
- Type `while True: pass` and **Run** → verify timeout message
- Leave editor empty → verify Submit button is disabled
