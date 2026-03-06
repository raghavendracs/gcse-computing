# GCSE Computer Science Platform — Design Document

**Date:** 2026-03-06
**Status:** Approved

---

## 1. Product Overview

A GCSE Computer Science revision and Python practice platform for secondary-school students. Parents manage student profiles; students practise theory and coding questions, receive guided hints, and get exam-style feedback. All history is stored for review and progress tracking.

---

## 2. Key Decisions

| Decision | Choice |
|---|---|
| Project structure | pnpm monorepo — `apps/web`, `apps/api`, shared packages |
| Auth | Custom JWT (HTTP-only cookie), parent + student roles |
| Database | MongoDB, 7 collections |
| API layer | Express + tRPC, TypeScript |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui |
| AI provider | Anthropic Claude — Sonnet (accurate/balanced), Haiku (budget) |
| AI model selection | Parent configures: Accurate / Balanced / Budget |
| Code execution | Pyodide (WASM) sandbox in Node worker + AI fallback |
| Code editor | CodeMirror 6 |
| Question generation | Seeded templates + AI-assisted generation simultaneously |
| Exam board | Student selects OCR / AQA / Edexcel on their profile (changeable) |
| Deployment | Docker Compose — 3 containers (web, api, mongodb) |

---

## 3. Project Structure

```
gcse-coding/
├── apps/
│   ├── web/                          # Next.js App Router frontend
│   └── api/                          # Express + tRPC backend
├── packages/
│   ├── database/                     # Mongoose models + TypeScript interfaces
│   │   ├── models/
│   │   │   ├── user.ts
│   │   │   ├── module.ts
│   │   │   ├── question-template.ts
│   │   │   ├── generated-question.ts
│   │   │   ├── question-attempt.ts
│   │   │   ├── hint-event.ts
│   │   │   └── study-session.ts
│   │   └── index.ts
│   ├── services/                     # Business logic
│   │   ├── question-generation-service/
│   │   ├── theory-marking-service/
│   │   ├── coding-assessment-service/
│   │   ├── hint-generation-service/
│   │   └── code-execution-service/   # Pyodide sandbox
│   └── trpc/                         # Shared tRPC router + types
│       └── server/
│           ├── routes/
│           │   ├── auth/
│           │   ├── modules/
│           │   ├── questions/
│           │   ├── sessions/
│           │   ├── history/
│           │   └── progress/
│           ├── context.ts
│           └── index.ts
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## 4. Authentication & User Model

### Roles

- **Parent**: signs up directly, manages student profiles, configures AI model preference
- **Student**: created by parent, logs in directly, manages own exam board preference

### Auth mechanism

- Custom JWT stored in HTTP-only cookie
- JWT payload: `{ userId, role, parentId? }`
- tRPC context validates JWT on every request
- `authenticatedProcedure` — any logged-in user
- `parentOnlyProcedure` — parent role only
- `studentProcedure` — student role only

### `users` collection schema

```typescript
{
  _id: ObjectId
  email: string
  passwordHash: string        // bcrypt
  fullName: string
  role: "parent" | "student"
  parentId?: ObjectId         // null for parents, set for students
  examBoardPreference?: "OCR" | "AQA" | "Edexcel"   // students only
  aiModelPreference?: "accurate" | "balanced" | "budget"  // parents only
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date
}
```

---

## 5. Data Model (MongoDB Collections)

### `modules`
Seeded curriculum data. One document per topic.

```typescript
{
  _id: ObjectId
  examBoard: "OCR" | "AQA" | "Edexcel" | "generic"
  moduleCode: string           // e.g. "PROG-01"
  moduleName: string           // e.g. "Programming Fundamentals"
  topicName: string            // e.g. "Sequence, Selection and Iteration"
  topicType: "theory" | "programming" | "mixed"
  description: string
  specReferences: string[]     // e.g. ["J277 2.2.1"]
  difficultyBands: ("easy" | "medium" | "hard")[]
  createdAt: Date
}
```

### `question_templates`
Handcrafted templates. Each generates many question variants.

```typescript
{
  _id: ObjectId
  moduleId: ObjectId
  questionType: "multiple_choice" | "short_answer" | "extended" | "coding" | "trace_table" | "fill_gap" | "predict_output" | "fix_code"
  templateName: string
  promptTemplate: string
  generationRules: {
    parameters: string[]
    difficulty: "easy" | "medium" | "hard"
  }
  rubric: {
    maxMarks: number
    markSchemePoints: string[]
    acceptedConcepts: string[]
    commonMisconceptions: string[]
  }
  hintFramework: string[]      // exactly 5 hints
  modelAnswerTemplate: string
  active: boolean
  createdAt: Date
}
```

### `generated_questions`
One per question instance shown to a user. Acts as a cache to prevent repetition.

```typescript
{
  _id: ObjectId
  moduleId: ObjectId
  templateId?: ObjectId        // null if purely AI-generated without template
  userId: ObjectId
  questionType: string
  difficulty: "easy" | "medium" | "hard"
  questionText: string
  answerFormat: "free_text" | "code" | "multiple_choice"
  maxMarks: number
  markSchemePoints: string[]
  modelAnswer: string
  hints: string[]              // 5 items
  testCases: { input: string; expectedOutput: string; hidden: boolean }[]
  metadata: {
    examBoard: string
    topicName: string
    misconceptionNotes: string[]
  }
  createdAt: Date
}
```

### `question_attempts`
Every submission stored, including re-attempts.

```typescript
{
  _id: ObjectId
  userId: ObjectId
  questionId: ObjectId
  moduleId: ObjectId
  attemptNumber: number
  submittedAnswer: string
  submissionType: "text" | "code"
  assessment: {
    awardedMarks: number
    maxMarks: number
    feedback: string
    missingPoints: string[]
    strengths: string[]
    confidence: number         // 0–1
  }
  codingAnalysis?: {
    syntaxValid: boolean
    testsPassed: number
    testsFailed: number
    errorCategory: "syntax" | "logic" | "runtime" | null
    executionPath: "sandbox" | "ai"
  }
  hintsUsedCount: number
  timeSpentSeconds: number
  createdAt: Date
}
```

### `hint_events`
Each hint request tracked individually.

```typescript
{
  _id: ObjectId
  userId: ObjectId
  questionId: ObjectId
  moduleId: ObjectId
  hintLevel: 1 | 2 | 3 | 4 | 5
  hintText: string
  requestedAt: Date
}
```

### `study_sessions`
Wraps a practice block (start to end).

```typescript
{
  _id: ObjectId
  userId: ObjectId
  moduleId: ObjectId
  mode: "theory" | "coding" | "mixed" | "timed" | "review"
  startedAt: Date
  endedAt?: Date
  questionIds: ObjectId[]
  summary: {
    questionsAttempted: number
    averageScore: number
    hintsUsed: number
  }
}
```

---

## 6. tRPC Router Structure

### Routers

| Router | Procedures |
|---|---|
| `auth` | `login`, `signup`, `logout`, `me`, `createStudent`, `updateProfile` |
| `modules` | `listModules`, `getModuleById` |
| `questions` | `generateQuestion`, `getQuestion`, `submitAnswer`, `requestHint` |
| `sessions` | `startSession`, `endSession`, `getSession` |
| `history` | `listAttempts`, `getAttemptDetail`, `listByModule` |
| `progress` | `getSummary`, `getModuleProgress`, `getWeakAreas` |

### Key procedure contracts

**`questions.generateQuestion`**
- Input: `{ moduleId, questionType, difficulty, examBoard }`
- Logic: check existing unused `generated_questions` for this user first → if found return cached → else generate via AI → save → return
- Output: full `GeneratedQuestion` object

**`questions.submitAnswer`**
- Input: `{ questionId, answer, submissionType }`
- Logic: route to `theory-marking-service` or `coding-assessment-service` based on type → store attempt → return assessment
- Output: `{ assessment, codingAnalysis?, nextAction: "hint" | "retry" | "complete" }`

**`questions.requestHint`**
- Input: `{ questionId, currentHintLevel }`
- Logic: fetch next hint from question record → store `hint_event` → return hint text
- Output: `{ hintText, hintLevel, isLastHint }`

**`progress.getSummary`**
- Input: `{ userId }`
- Logic: aggregate attempts by module → compute avg score, hint dependency, weak areas
- Output: `{ moduleScores[], weakAreas[], streakDays, totalAttempts }`

### Frontend hooks pattern

```typescript
// Mutations — return mutation object directly
useGenerateQuestion()
useSubmitAnswer()
useRequestHint()
useStartSession()
useEndSession()
useCreateStudent()

// Queries — return { data, isLoading, isFetching, refetch }
useGetProgress(userId)
useListHistory(filters)
useListModules(examBoard)
useGetModuleProgress(moduleId)
```

---

## 7. AI Services Architecture

All services in `packages/services/`, all use structured JSON output contracts, all wrap calls with error handling and fallback.

### `question-generation-service`

- Input: `{ moduleId, topicName, questionType, difficulty, examBoard, priorQuestionIds[] }`
- System prompt constrains output to exact JSON schema
- Output contract:
  ```json
  {
    "questionText": "...",
    "maxMarks": 4,
    "markSchemePoints": ["...", "..."],
    "hints": ["...", "...", "...", "...", "..."],
    "modelAnswer": "...",
    "testCases": [],
    "misconceptionNotes": ["..."],
    "difficulty": "medium"
  }
  ```
- Validates output — rejects if fields missing or marks inconsistent

### `theory-marking-service`

- Input: `{ questionText, markSchemePoints[], submittedAnswer, maxMarks }`
- Always uses `claude-haiku-4-5-20251001` for speed
- Output: `{ awardedMarks, feedback, missingPoints, strengths, confidence }`

### `coding-assessment-service`

- First attempts Pyodide sandbox execution
- Falls back to AI if execution fails or is unsafe
- AI input: `{ questionText, submittedCode, testCases[], rubric }`
- AI output: `{ syntaxValid, conceptualScore, feedback, errorCategory }`

### `hint-generation-service`

- Input: `{ questionText, studentAttempt, hintLevel, topic }`
- Generates hint adapted to the student's specific attempt (not generic)
- Hard rule: hint 5 is near-solution scaffolding, never full answer

### Model mapping

| Parent setting | Claude model |
|---|---|
| Accurate | `claude-sonnet-4-6` |
| Balanced | `claude-sonnet-4-6` |
| Budget | `claude-haiku-4-5-20251001` |

---

## 8. Code Execution

### Pyodide sandbox (Layer 1)

- Pyodide npm package runs Python WASM in a Node.js worker thread inside the API service
- Hard limits: 5s timeout, no filesystem, no network, stdlib only
- Strips unsafe imports before execution
- Captures stdout, stderr, exceptions
- Runs visible + hidden test cases, reports pass/fail per case
- Result stored as `executionPath: "sandbox"`

### AI fallback (Layer 2)

Triggered when:
- Execution times out
- Unsafe imports detected
- Question requires file I/O or complex stdlib
- Result stored as `executionPath: "ai"`

### Code editor (frontend)

- CodeMirror 6 with Python language pack
- Syntax highlighting, line numbers, basic indentation
- No LSP — intentionally minimal for GCSE level focus

---

## 9. Docker Deployment

```yaml
services:
  mongodb:
    image: mongo:7
    volumes: [mongo-data:/data/db]
    healthcheck: ...

  api:
    build: ./apps/api
    ports: ["3001:3001"]
    environment:
      MONGODB_URI: mongodb://mongodb:27017/gcse
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      PYODIDE_TIMEOUT_MS: 5000
    depends_on: [mongodb]

  web:
    build: ./apps/web
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
    depends_on: [api]
```

### Seed script (`apps/api/src/seed/`)

- Idempotent — safe to re-run
- Seeds 9 modules with spec references (OCR J277 + AQA equivalents)
- Seeds 5+ question templates per topic (theory + coding)
- Runs automatically on API startup if collections are empty

---

## 10. Key Screens

1. Landing / login
2. Sign-up (parent) + create student profile
3. Student dashboard — module cards, quick stats, continue last session
4. Module detail — choose mode (theory / coding / mixed / timed)
5. Question screen (theory) — question, answer input, hint button, submit
6. Question screen (coding) — CodeMirror editor, run button, hint button, test output panel
7. Feedback screen — marks, breakdown, model answer reveal
8. History page — filterable by module, date, score
9. Progress page — module scores, weak areas, streak
10. Parent dashboard — all students' progress overview

---

## 11. Build Phases

| Phase | Scope |
|---|---|
| 1 — Foundation | Monorepo scaffold, auth, MongoDB, module seed, dashboard |
| 2 — Theory practice | Question generation, theory submission, marking, history |
| 3 — Coding practice | CodeMirror editor, Pyodide sandbox, coding questions, hints |
| 4 — Coding sandbox upgrade | Separate Python container (FastAPI) for accurate code execution |
| 5 — Progress & review | Progress page, history views, anti-repetition, weak area detection |
| 6 — Gamification | XP system, badges, streaks, level-up rewards |
| 7 — Parent dashboard | Separate parent login view, per-student analytics, progress reports |
| 8 — Deployment | Docker Compose (5 containers), seed script, environment config |

---

## 12. Additional v1 Features

### Parent analytics dashboard (Phase 7)
- Separate `/parent` route group, parent-only access
- Per-student summary cards: score trends, hint dependency, weak topics
- Filterable by student, module, date range
- Session history timeline
- `progress.getParentSummary` tRPC procedure

### Gamification / badges / streaks (Phase 6)
- XP earned per question attempt (based on marks and hint count)
- Daily streak counter (days with at least one attempt)
- Badges: e.g. "First question", "5-day streak", "Perfect score", "Coding champion"
- Level system (Bronze → Silver → Gold → Platinum) based on total XP
- `gamification` collection: `{ userId, xp, level, streakDays, lastActivityDate, badges[] }`
- `gamification` tRPC router: `getMyStats`, `getBadges`
- Dashboard streak widget and XP progress bar

### Advanced Python sandbox (Phase 4)
- Separate FastAPI (Python) microservice in `apps/python-sandbox/`
- 4th Docker container
- Accepts: `{ code, testCases, timeoutMs }`
- Returns: `{ stdout, stderr, testResults[], executionTimeMs }`
- More accurate than Pyodide WASM for real Python edge cases (stdlib, complex I/O)
- Pyodide retained as fallback if sandbox container unreachable
- Communication via internal Docker network HTTP call from API service

---

## 13. Open Decisions (post-v1)

- Printable worksheets / PDF export
- Multiple exam board divergence (deep spec differences per board)
- Teacher classroom dashboard (multi-parent, multi-student management)
- Real-time multiplayer revision challenges
