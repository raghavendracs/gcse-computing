# Phase 3 — Coding Practice Design

**Date:** 2026-03-07

## Goal

Give students a full coding practice loop: AI-generated Python coding questions, a CodeMirror editor, real Python execution via a FastAPI sandbox container, dynamic AI-powered hints based on their actual code, and AI marking on final submission.

---

## Architecture

Phase 3 adds a 4th Docker container — a FastAPI Python microservice — alongside the existing 3 (mongodb, api, web).

```
Browser (CodeMirror)
  → tRPC questions.runCode       → API → python-sandbox:8000/execute → test results
  → tRPC questions.requestCodingHint → API → AI (dynamic, code-aware hint)
  → tRPC questions.submitAnswer  → API → coding-assessment-service → AI marking
                                        ↘ AI fallback if sandbox unreachable
```

### New containers / services

| Component | Location | Responsibility |
|---|---|---|
| `python-sandbox` | `apps/python-sandbox/` | FastAPI app — accepts code + test cases, executes in subprocess with limits, returns results |
| `code-execution-service` | `packages/services/src/code-execution-service/` | HTTP client to python-sandbox; AI fallback if unreachable |
| `coding-assessment-service` | `packages/services/src/coding-assessment-service/` | AI marks code given execution results + question context |
| `hint-generation-service` | `packages/services/src/hint-generation-service/` | AI generates dynamic hints based on student's current code |

### Existing pieces extended

- `question-generation-service` — extended to generate coding questions (`answerFormat: "code"`) with test cases when module has coding templates
- `questions` tRPC router — adds `runCode` and `requestCodingHint` procedures
- `submitAnswer` — unchanged; already supports `submissionType: "code"` and `codingAnalysis` fields in DB
- Module detail page — adds "Coding" button to mode picker

---

## Services

### `python-sandbox` (FastAPI)

**Endpoint:** `POST /execute`

**Request:**
```json
{
  "code": "def solution(n):\n    return n * n",
  "testCases": [
    { "input": "5", "expectedOutput": "25" },
    { "input": "0", "expectedOutput": "0" }
  ],
  "timeoutMs": 5000
}
```

**Response:**
```json
{
  "testResults": [
    { "input": "5", "expectedOutput": "25", "actualOutput": "25", "passed": true },
    { "input": "0", "expectedOutput": "0", "actualOutput": "0", "passed": true }
  ],
  "stdout": "",
  "stderr": "",
  "executionTimeMs": 12,
  "timedOut": false,
  "blocked": false,
  "blockReason": null
}
```

**Safety rules:**
- Strips / rejects dangerous imports before execution: `os`, `subprocess`, `socket`, `sys`, `shutil`, `pathlib`, `importlib`, `ctypes`, `multiprocessing`, `threading`
- 5s hard timeout per execution (subprocess killed)
- No filesystem access, no network access
- Each test case run independently with fresh namespace

### `code-execution-service`

- Calls `python-sandbox` via HTTP (`fetch` / `node:http`)
- If sandbox unreachable (ECONNREFUSED / timeout): falls back to AI simulation
- Returns unified `ExecutionResult` type regardless of path
- Records `executionPath: "sandbox" | "ai"` for storage

### `coding-assessment-service`

Input:
```typescript
{
  questionText: string
  submittedCode: string
  testResults: TestResult[]
  markSchemePoints: string[]
  maxMarks: number
  modelId: string
}
```

AI prompt includes: question, code, test results, mark scheme.
Returns: `{ awardedMarks, feedback, strengths, missingPoints, confidence, syntaxValid, errorCategory }`

### `hint-generation-service`

Input:
```typescript
{
  questionText: string
  submittedCode: string        // student's current code at time of hint request
  testResults?: TestResult[]   // last run results, if any
  hintLevel: 1 | 2 | 3 | 4 | 5
  modelId: string
}
```

- Hints 1–4: progressively more specific, never reveal code
- Hint 5: near-solution scaffolding (pseudocode or structural guidance), never the full answer
- Stored as `HintEvent` (same collection as theory hints)

---

## tRPC procedures (added to `questions` router)

### `questions.runCode`
- **Auth:** `studentProcedure`
- **Input:** `{ questionId, code }`
- **Action:** loads question test cases from DB, calls `code-execution-service`, returns results
- **Does NOT store an attempt** — free to call multiple times

### `questions.requestCodingHint`
- **Auth:** `studentProcedure`
- **Input:** `{ questionId, code, currentHintLevel, testResults? }`
- **Action:** calls `hint-generation-service`, stores `HintEvent`, returns hint text
- **Max 5 hints** — throws `BAD_REQUEST` if `currentHintLevel >= 5`

### `questions.submitAnswer` (extended)
- Already exists; extended to detect `answerFormat: "code"` and route to `coding-assessment-service` instead of `theory-marking-service`
- Stores `submissionType: "code"` and `codingAnalysis` on the `QuestionAttempt` document

---

## Question generation (coding)

The existing `question-generation-service` is extended:

- If a module has `questionType: "coding"` templates, generates questions with `answerFormat: "code"`
- AI prompt produces test cases instead of mark scheme points:
  ```json
  {
    "questionText": "Write a function...",
    "maxMarks": 4,
    "testCases": [
      { "input": "5", "expectedOutput": "25", "hidden": false },
      { "input": "0", "expectedOutput": "0", "hidden": false },
      { "input": "-3", "expectedOutput": "9", "hidden": true }
    ],
    "modelAnswer": "def solution(n):\n    return n * n",
    "hints": ["h1","h2","h3","h4","h5"],
    "markSchemePoints": ["Function defined correctly", "Returns n squared", ...]
  }
  ```
- Validation: at least 2 visible test cases, at least 1 hidden test case
- Seeds: at least 2 coding question templates per module in the seed script

---

## Frontend

### New page: `/modules/[id]/coding`

`apps/web/app/(dashboard)/modules/[id]/coding/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│ Coding Practice   [topic]      0:00  End│
├─────────────────────────────────────────┤
│ Question                     [4 marks]  │
│ Write a function that...                │
├─────────────────────────────────────────┤
│ [Hints panel — collapsible, same as     │
│  theory: collapses when editor focused] │
├─────────────────────────────────────────┤
│ [CodeMirror editor — Python]            │
│  def solution():                        │
│      ...                                │
│                                         │
├─────────────────────────────────────────┤
│ [Run ▶]  [Get hint]        [Submit →]   │
├─────────────────────────────────────────┤
│ Test Results (shown after Run)          │
│ ✓ Test 1  input="5"  expected="25"      │
│ ✗ Test 2  input="0"  expected="0"       │
│           actual: "None"                │
│ — hidden test (passing)                 │
└─────────────────────────────────────────┘
```

**Interactions:**
- **Run** → calls `useRunCode` → shows test results panel; editor stays editable
- **Get hint** → calls `useRequestCodingHint` with current editor code + last test results → hint appears above editor in collapsible panel
- **Submit** → calls existing `useSubmitAnswer` with `{ answer: code, submissionType: "code" }` → shows assessment panel (replaces editor)
- **After submit** → "Next question →" and "End session" buttons (same as theory)

**Hidden test cases:** shown as "Hidden test ✓" or "Hidden test ✗" — no input/expected value revealed

### Module detail page update

`apps/web/app/(dashboard)/modules/[id]/page.tsx` — adds "Coding" button to the mode picker that navigates to `/modules/[id]/coding?sessionId=...`

### New hooks

`apps/web/hooks/api/questions.tsx` — adds:
- `useRunCode` — mutation
- `useRequestCodingHint` — mutation

---

## Error handling

| Error | Source | User-facing message |
|---|---|---|
| Syntax error | sandbox `stderr` | Red banner: "Syntax error — check your code" + stderr excerpt |
| Timeout | `timedOut: true` | "Code took too long — check for infinite loops" |
| Blocked import | `blocked: true` | "Restricted: `os` is not allowed in GCSE practice" |
| Sandbox unreachable | ECONNREFUSED | Transparent AI fallback; no user-visible message |
| No code written | client | Submit button disabled when editor is empty |

---

## Docker Compose update

```yaml
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

`api` service gains `PYTHON_SANDBOX_URL: http://python-sandbox:8000` env var.

---

## Testing

| Layer | Test file | What's tested |
|---|---|---|
| `python-sandbox` | `apps/python-sandbox/tests/test_execute.py` | Correct output, syntax errors, timeouts, blocked imports |
| `code-execution-service` | `__tests__/code-execution.test.ts` | HTTP call mocked; fallback path; result shape |
| `coding-assessment-service` | `__tests__/coding-assessment.test.ts` | AI mock; marks awarded; codingAnalysis shape |
| `hint-generation-service` | `__tests__/hint-generation.test.ts` | AI mock; 5-level progression; hint stored |

---

## File changes summary

```
New:
  apps/python-sandbox/
    main.py
    requirements.txt
    Dockerfile
    tests/test_execute.py
  packages/services/src/code-execution-service/
    index.ts
    models.ts
    __tests__/code-execution.test.ts
  packages/services/src/coding-assessment-service/
    index.ts
    models.ts
    __tests__/coding-assessment.test.ts
  packages/services/src/hint-generation-service/
    index.ts
    models.ts
    __tests__/hint-generation.test.ts
  apps/web/app/(dashboard)/modules/[id]/coding/
    page.tsx

Modified:
  packages/services/src/question-generation-service/index.ts  ← coding question support
  packages/trpc/src/server/routes/questions/route.ts          ← runCode, requestCodingHint
  packages/trpc/src/server/routes/questions/models.ts         ← new input/output models
  packages/services/src/index.ts                              ← export new services
  apps/web/hooks/api/questions.tsx                            ← useRunCode, useRequestCodingHint
  apps/web/app/(dashboard)/modules/[id]/page.tsx              ← Coding button
  docker-compose.yml                                          ← python-sandbox service
  apps/api/src/index.ts (or env config)                       ← PYTHON_SANDBOX_URL
```
