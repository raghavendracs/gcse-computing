# Phase 2 — Theory Practice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement AI-powered theory question generation, answer marking, hint system, study sessions, and history — giving students a full theory practice loop end-to-end.

**Architecture:** New services (`question-generation-service`, `theory-marking-service`) call the Anthropic API; three new tRPC routers (`questions`, `sessions`, `history`) wire them to the frontend; the practice UI lives at `/modules/[id]/practice`.

**Tech Stack:** `@anthropic-ai/sdk`, Anthropic Claude (Sonnet for generation, Haiku for marking), Mongoose, tRPC v11, Next.js 16, Tailwind CSS, Vitest

---

## Codebase Orientation

```
gcse-coding/
├── packages/
│   ├── database/src/models/          ← Mongoose models (all 7 exist from Phase 1)
│   ├── services/src/
│   │   ├── auth-service/             ← Phase 1 pattern to follow exactly
│   │   └── index.ts                  ← barrel: currently exports AuthService only
│   └── trpc/src/server/
│       ├── routes/                   ← auth/, modules/ exist; add questions/, sessions/, history/
│       ├── trpc.ts                   ← exports router, publicProcedure, authenticatedProcedure,
│       │                                parentOnlyProcedure, studentProcedure
│       └── index.ts                  ← appRouter with auth + modules; extend here
└── apps/web/
    ├── hooks/api/                    ← auth.tsx, modules.tsx exist; add questions, sessions, history
    └── app/(dashboard)/
        └── modules/[id]/
            ├── page.tsx              ← placeholder "coming in Phase 2" — replace
            └── practice/page.tsx     ← NEW: theory practice screen
```

**Pattern rules (must follow):**
- Services instantiated at module level in route files: `const svc = new MyService()`
- Never add services to tRPC context — pass directly in route handlers
- `authenticatedProcedure` / `studentProcedure` from `../../trpc`
- Hooks: mutations return mutation object, queries return `{ data: ..., isLoading, isFetching, refetch }`
- Test mocks: `vi.mock("@gcse/database", () => ({ ModelName: { findOne: vi.fn(), ... } }))`
- No commits in this plan

---

## Task 1: Install Anthropic SDK + model mapping utility

**Files:**
- Modify: `packages/services/package.json`
- Create: `packages/services/src/ai/model-map.ts`
- Modify: `docker-compose.yml`
- Modify: `apps/api/.env`

**Step 1: Add `@anthropic-ai/sdk` to services**

In `packages/services/package.json`, add to `dependencies`:
```json
"@anthropic-ai/sdk": "^0.36.0"
```

Full updated `dependencies` block:
```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.36.0",
  "@gcse/database": "workspace:*",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.0",
  "zod": "^3.23.0"
}
```

**Step 2: Run pnpm install**

```bash
cd /path/to/gcse-coding
pnpm install
```

Expected: lockfile updated, `@anthropic-ai/sdk` installed in workspace.

**Step 3: Create model-map utility**

Create `packages/services/src/ai/model-map.ts`:
```typescript
export type AIModelPreference = "accurate" | "balanced" | "budget";

const MODEL_MAP: Record<AIModelPreference, string> = {
  accurate: "claude-sonnet-4-6",
  balanced: "claude-sonnet-4-6",
  budget: "claude-haiku-4-5-20251001",
};

export function getModelId(preference: AIModelPreference = "balanced"): string {
  return MODEL_MAP[preference];
}
```

**Step 4: Add ANTHROPIC_API_KEY to docker-compose.yml**

In `docker-compose.yml`, add to the `api` service's `environment` block:
```yaml
  api:
    ...
    environment:
      MONGODB_URI: mongodb://mongodb:27017/gcse
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production-min-32-chars}
      PORT: 3001
      WEB_URL: http://localhost:3000
      NODE_ENV: production
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
```

**Step 5: Add ANTHROPIC_API_KEY to apps/api/.env**

In `apps/api/.env`, add:
```
ANTHROPIC_API_KEY=your-key-here
```

**Step 6: Verify build still passes**

```bash
cd packages/services && pnpm build
```
Expected: exits 0 with no TypeScript errors.

---

## Task 2: question-generation-service

**Files:**
- Create: `packages/services/src/question-generation-service/models.ts`
- Create: `packages/services/src/question-generation-service/index.ts`
- Create: `packages/services/src/question-generation-service/__tests__/question-generation.test.ts`

**Step 1: Write the failing test**

Create `packages/services/src/question-generation-service/__tests__/question-generation.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import QuestionGenerationService from "../index";

vi.mock("@gcse/database", () => ({
  GeneratedQuestion: {
    findOne: vi.fn(),
    insertOne: vi.fn(),
  },
  Module: {
    findOne: vi.fn(),
  },
  QuestionTemplate: {
    findOne: vi.fn(),
  },
  User: {
    findOne: vi.fn(),
  },
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import { GeneratedQuestion, Module, QuestionTemplate, User } from "@gcse/database";
import Anthropic from "@anthropic-ai/sdk";

const mockModule = {
  _id: { toString: () => "mod1" },
  topicName: "Sequence and Selection",
  examBoard: "generic",
};

const mockTemplate = {
  _id: { toString: () => "tmpl1" },
  questionType: "short_answer",
  promptTemplate: "Explain the difference between a variable and a constant.",
  rubric: {
    maxMarks: 4,
    acceptedConcepts: ["variable", "constant"],
    commonMisconceptions: ["confusing constants with variables"],
  },
};

const mockAIResponse = {
  questionText: "What is the difference between a variable and a constant?",
  maxMarks: 4,
  markSchemePoints: ["p1", "p2", "p3", "p4"],
  hints: ["h1", "h2", "h3", "h4", "h5"],
  modelAnswer: "A variable can change; a constant cannot.",
  misconceptionNotes: ["common mistake"],
};

describe("QuestionGenerationService", () => {
  let svc: QuestionGenerationService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new QuestionGenerationService();
    // Get the mock instance created in constructor
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  it("returns cached unused question if available", async () => {
    const cached = {
      _id: { toString: () => "q1" },
      moduleId: { toString: () => "mod1" },
      questionType: "short_answer",
      difficulty: "medium",
      questionText: "Cached question?",
      answerFormat: "free_text",
      maxMarks: 4,
      markSchemePoints: ["p1"],
      modelAnswer: "answer",
      hints: ["h1", "h2", "h3", "h4", "h5"],
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Topic", misconceptionNotes: [] },
    };
    (GeneratedQuestion.findOne as any).mockResolvedValue(cached);

    const result = await svc.generateQuestion({
      moduleId: "mod1",
      userId: "user1",
      difficulty: "medium",
    });

    expect(result.id).toBe("q1");
    expect(result.questionText).toBe("Cached question?");
    expect(Module.findOne).not.toHaveBeenCalled();
  });

  it("generates a new question via AI when no cache exists", async () => {
    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(mockModule);
    (QuestionTemplate.findOne as any).mockResolvedValue(mockTemplate);
    (User.findOne as any).mockResolvedValue({ role: "student", parentId: null });
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(mockAIResponse) }],
    });
    const savedDoc = {
      _id: { toString: () => "newq1" },
      moduleId: { toString: () => "mod1" },
      questionType: "short_answer",
      difficulty: "medium",
      questionText: mockAIResponse.questionText,
      answerFormat: "free_text",
      maxMarks: 4,
      markSchemePoints: mockAIResponse.markSchemePoints,
      modelAnswer: mockAIResponse.modelAnswer,
      hints: mockAIResponse.hints,
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Sequence and Selection", misconceptionNotes: [] },
    };
    (GeneratedQuestion.insertOne as any).mockResolvedValue(savedDoc);

    const result = await svc.generateQuestion({
      moduleId: "mod1",
      userId: "user1",
      difficulty: "medium",
    });

    expect(mockClient.messages.create).toHaveBeenCalledOnce();
    expect(result.questionText).toBe(mockAIResponse.questionText);
    expect(result.hints).toHaveLength(5);
  });

  it("handles AI response wrapped in markdown code blocks", async () => {
    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(mockModule);
    (QuestionTemplate.findOne as any).mockResolvedValue(mockTemplate);
    (User.findOne as any).mockResolvedValue({ role: "student", parentId: null });
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + JSON.stringify(mockAIResponse) + "\n```" }],
    });
    (GeneratedQuestion.insertOne as any).mockResolvedValue({
      _id: { toString: () => "q2" },
      moduleId: { toString: () => "mod1" },
      questionType: "short_answer",
      difficulty: "medium",
      questionText: mockAIResponse.questionText,
      answerFormat: "free_text",
      maxMarks: 4,
      markSchemePoints: mockAIResponse.markSchemePoints,
      modelAnswer: mockAIResponse.modelAnswer,
      hints: mockAIResponse.hints,
      testCases: [],
      metadata: { examBoard: "generic", topicName: "Topic", misconceptionNotes: [] },
    });

    const result = await svc.generateQuestion({ moduleId: "mod1", userId: "user1" });
    expect(result.questionText).toBe(mockAIResponse.questionText);
  });

  it("throws if module not found", async () => {
    (GeneratedQuestion.findOne as any).mockResolvedValue(null);
    (Module.findOne as any).mockResolvedValue(null);

    await expect(
      svc.generateQuestion({ moduleId: "bad-id", userId: "user1" }),
    ).rejects.toThrow("Module not found");
  });
});
```

**Step 2: Run the test to verify it fails**

```bash
cd packages/services && pnpm test
```
Expected: FAIL — `QuestionGenerationService` module not found.

**Step 3: Create models.ts**

Create `packages/services/src/question-generation-service/models.ts`:
```typescript
import { z } from "zod";

export const generateQuestionInput = z.object({
  moduleId: z.string(),
  userId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
});

export type GenerateQuestionInput = z.infer<typeof generateQuestionInput>;

export const generatedQuestionOutput = z.object({
  id: z.string(),
  moduleId: z.string(),
  questionType: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionText: z.string(),
  answerFormat: z.enum(["free_text", "code", "multiple_choice"]),
  maxMarks: z.number(),
  markSchemePoints: z.array(z.string()),
  hints: z.array(z.string()),
  testCases: z.array(
    z.object({ input: z.string(), expectedOutput: z.string(), hidden: z.boolean() }),
  ),
  metadata: z.object({
    examBoard: z.string(),
    topicName: z.string(),
    misconceptionNotes: z.array(z.string()),
  }),
});

export type GeneratedQuestionOutput = z.infer<typeof generatedQuestionOutput>;
```

**Step 4: Create index.ts**

Create `packages/services/src/question-generation-service/index.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { GeneratedQuestion, Module, QuestionTemplate, User } from "@gcse/database";
import { Types } from "mongoose";
import { getModelId } from "../ai/model-map";
import { type GenerateQuestionInput, type GeneratedQuestionOutput } from "./models";

class QuestionGenerationService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestionOutput> {
    const { moduleId, userId, difficulty = "medium", examBoard } = input;

    // 1. Return cached unused question if available
    const cached = await GeneratedQuestion.findOne({
      $and: [
        { userId: new Types.ObjectId(userId) },
        { moduleId: new Types.ObjectId(moduleId) },
        { difficulty },
        { usedInSession: false },
      ],
    });
    if (cached) return this.toOutput(cached);

    // 2. Load module
    const mod = await Module.findOne({ _id: new Types.ObjectId(moduleId) });
    if (!mod) throw new Error("Module not found");

    // 3. Find a matching template
    const template = await QuestionTemplate.findOne({
      $and: [{ moduleId: new Types.ObjectId(moduleId) }, { active: true }],
    });

    // 4. Resolve AI model from user/parent preference
    const modelId = await this.resolveModel(userId);

    // 5. Generate via AI
    const generated = await this.callAI(mod, template, difficulty, examBoard, modelId);

    // 6. Save and return
    const doc = await GeneratedQuestion.insertOne({
      moduleId: new Types.ObjectId(moduleId),
      templateId: template ? template._id : undefined,
      userId: new Types.ObjectId(userId),
      questionType: template?.questionType ?? "short_answer",
      difficulty,
      questionText: generated.questionText,
      answerFormat: "free_text",
      maxMarks: generated.maxMarks,
      markSchemePoints: generated.markSchemePoints,
      modelAnswer: generated.modelAnswer,
      hints: generated.hints,
      testCases: [],
      metadata: {
        examBoard: examBoard ?? mod.examBoard,
        topicName: mod.topicName,
        misconceptionNotes: generated.misconceptionNotes,
      },
      usedInSession: false,
    });

    return this.toOutput(doc);
  }

  private async resolveModel(userId: string): Promise<string> {
    const user = await User.findOne({ _id: new Types.ObjectId(userId) });
    if (!user) return getModelId("balanced");
    if (user.role === "parent") return getModelId(user.aiModelPreference ?? "balanced");
    if (user.parentId) {
      const parent = await User.findOne({ _id: user.parentId });
      return getModelId(parent?.aiModelPreference ?? "balanced");
    }
    return getModelId("balanced");
  }

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
  }> {
    const systemPrompt = `You are a GCSE Computer Science examiner. Generate exam-style questions in valid JSON only.
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

    const userPrompt = `Generate a ${difficulty} short_answer question about "${mod.topicName}" for ${examBoard ?? mod.examBoard} GCSE.
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

    return {
      questionText: parsed.questionText,
      maxMarks: parsed.maxMarks,
      markSchemePoints: parsed.markSchemePoints,
      hints: parsed.hints,
      modelAnswer: parsed.modelAnswer,
      misconceptionNotes: Array.isArray(parsed.misconceptionNotes) ? parsed.misconceptionNotes : [],
    };
  }

  private toOutput(doc: any): GeneratedQuestionOutput {
    return {
      id: doc._id.toString(),
      moduleId: doc.moduleId.toString(),
      questionType: doc.questionType,
      difficulty: doc.difficulty as "easy" | "medium" | "hard",
      questionText: doc.questionText,
      answerFormat: doc.answerFormat as "free_text" | "code" | "multiple_choice",
      maxMarks: doc.maxMarks,
      markSchemePoints: doc.markSchemePoints ?? [],
      hints: doc.hints ?? [],
      testCases: doc.testCases ?? [],
      metadata: {
        examBoard: doc.metadata?.examBoard ?? "",
        topicName: doc.metadata?.topicName ?? "",
        misconceptionNotes: doc.metadata?.misconceptionNotes ?? [],
      },
    };
  }
}

export default QuestionGenerationService;
```

**Step 5: Run tests to verify they pass**

```bash
cd packages/services && pnpm test
```
Expected: all tests pass including the 4 new question-generation tests.

---

## Task 3: theory-marking-service

**Files:**
- Create: `packages/services/src/theory-marking-service/models.ts`
- Create: `packages/services/src/theory-marking-service/index.ts`
- Create: `packages/services/src/theory-marking-service/__tests__/theory-marking.test.ts`

**Step 1: Write the failing test**

Create `packages/services/src/theory-marking-service/__tests__/theory-marking.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd packages/services && pnpm test
```
Expected: FAIL — `TheoryMarkingService` module not found.

**Step 3: Create models.ts**

Create `packages/services/src/theory-marking-service/models.ts`:
```typescript
import { z } from "zod";

export const markAnswerInput = z.object({
  questionText: z.string(),
  markSchemePoints: z.array(z.string()),
  submittedAnswer: z.string(),
  maxMarks: z.number().int().positive(),
});

export type MarkAnswerInput = z.infer<typeof markAnswerInput>;

export const markAnswerOutput = z.object({
  awardedMarks: z.number().int().min(0),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type MarkAnswerOutput = z.infer<typeof markAnswerOutput>;
```

**Step 4: Create index.ts**

Create `packages/services/src/theory-marking-service/index.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { type MarkAnswerInput, type MarkAnswerOutput } from "./models";

class TheoryMarkingService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async markAnswer(input: MarkAnswerInput): Promise<MarkAnswerOutput> {
    const systemPrompt = `You are a fair GCSE Computer Science examiner. Mark student answers strictly but fairly.
Output ONLY a JSON object with exactly these fields:
{
  "awardedMarks": 3,
  "feedback": "2-3 sentences of constructive, exam-technique focused feedback",
  "missingPoints": ["mark scheme concept the student missed"],
  "strengths": ["what the student got right"],
  "confidence": 0.9
}
Rules:
- awardedMarks must be an integer between 0 and maxMarks (inclusive)
- confidence is a float 0.0–1.0 indicating your marking certainty
- missingPoints lists mark scheme concepts not addressed by the student
- strengths lists what the student got right
- feedback is 2-3 sentences, constructive and exam-technique focused`;

    const userPrompt = `Question: ${input.questionText}

Mark scheme (${input.maxMarks} marks total):
${input.markSchemePoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Student answer: ${input.submittedAnswer}`;

    const message = await this.client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
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
      typeof parsed.awardedMarks !== "number" ||
      typeof parsed.feedback !== "string" ||
      !Array.isArray(parsed.missingPoints) ||
      !Array.isArray(parsed.strengths) ||
      typeof parsed.confidence !== "number"
    ) {
      throw new Error("Invalid marking response from AI");
    }

    return {
      awardedMarks: Math.max(0, Math.min(input.maxMarks, Math.round(parsed.awardedMarks))),
      feedback: parsed.feedback,
      missingPoints: parsed.missingPoints as string[],
      strengths: parsed.strengths as string[],
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
    };
  }
}

export default TheoryMarkingService;
```

**Step 5: Run tests to verify they pass**

```bash
cd packages/services && pnpm test
```
Expected: all tests pass (previously 4 auth tests + 4 question-gen tests + 5 theory-marking tests).

**Step 6: Export new services from barrel**

Update `packages/services/src/index.ts`:
```typescript
export { default as AuthService } from "./auth-service/index";
export { default as QuestionGenerationService } from "./question-generation-service/index";
export { default as TheoryMarkingService } from "./theory-marking-service/index";
```

**Step 7: Build services**

```bash
cd packages/services && pnpm build
```
Expected: exits 0 with `dist/` containing all compiled files.

---

## Task 4: tRPC questions router

**Files:**
- Create: `packages/trpc/src/server/routes/questions/models.ts`
- Create: `packages/trpc/src/server/routes/questions/route.ts`

**Step 1: Create models.ts**

Create `packages/trpc/src/server/routes/questions/models.ts`:
```typescript
import { z } from "zod";

export const generateQuestionInputModel = z.object({
  moduleId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
});

const testCaseModel = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean(),
});

export const generatedQuestionOutputModel = z.object({
  id: z.string(),
  moduleId: z.string(),
  questionType: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionText: z.string(),
  answerFormat: z.enum(["free_text", "code", "multiple_choice"]),
  maxMarks: z.number(),
  markSchemePoints: z.array(z.string()),
  hints: z.array(z.string()),
  testCases: z.array(testCaseModel),
  metadata: z.object({
    examBoard: z.string(),
    topicName: z.string(),
    misconceptionNotes: z.array(z.string()),
  }),
});

export const submitAnswerInputModel = z.object({
  questionId: z.string(),
  sessionId: z.string().optional(),
  answer: z.string().min(1, "Answer cannot be empty"),
  hintsUsed: z.number().int().min(0).default(0),
  timeSpentSeconds: z.number().int().min(0).default(0),
});

const assessmentModel = z.object({
  awardedMarks: z.number(),
  maxMarks: z.number(),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  confidence: z.number(),
});

export const submitAnswerOutputModel = z.object({
  attemptId: z.string(),
  assessment: assessmentModel,
  modelAnswer: z.string(),
  markSchemePoints: z.array(z.string()),
});

export const requestHintInputModel = z.object({
  questionId: z.string(),
  currentHintLevel: z.number().int().min(0).max(4),
});

export const requestHintOutputModel = z.object({
  hintText: z.string(),
  hintLevel: z.number(),
  isLastHint: z.boolean(),
});
```

**Step 2: Create route.ts**

Create `packages/trpc/src/server/routes/questions/route.ts`:
```typescript
import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { GeneratedQuestion, HintEvent, QuestionAttempt, StudySession } from "@gcse/database";
import { QuestionGenerationService, TheoryMarkingService } from "@gcse/services";
import { studentProcedure, router } from "../../trpc";
import {
  generateQuestionInputModel,
  generatedQuestionOutputModel,
  submitAnswerInputModel,
  submitAnswerOutputModel,
  requestHintInputModel,
  requestHintOutputModel,
} from "./models";

const questionGenSvc = new QuestionGenerationService();
const markingSvc = new TheoryMarkingService();

export const questionsRouter = router({
  generateQuestion: studentProcedure
    .input(generateQuestionInputModel)
    .output(generatedQuestionOutputModel)
    .mutation(async ({ ctx, input }) => {
      return questionGenSvc.generateQuestion({
        moduleId: input.moduleId,
        userId: ctx.user.userId,
        difficulty: input.difficulty ?? "medium",
        examBoard: input.examBoard,
      });
    }),

  submitAnswer: studentProcedure
    .input(submitAnswerInputModel)
    .output(submitAnswerOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user.userId) },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      // Mark question as used
      await GeneratedQuestion.updateOne(
        { _id: question._id },
        { $set: { usedInSession: true } },
      );

      // Count prior attempts for attempt number
      const priorCount = await QuestionAttempt.countDocuments({
        $and: [
          { questionId: question._id },
          { userId: new Types.ObjectId(ctx.user.userId) },
        ],
      });

      // Mark the answer
      const assessment = await markingSvc.markAnswer({
        questionText: question.questionText,
        markSchemePoints: question.markSchemePoints,
        submittedAnswer: input.answer,
        maxMarks: question.maxMarks,
      });

      // Store attempt
      const attempt = await QuestionAttempt.insertOne({
        userId: new Types.ObjectId(ctx.user.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        attemptNumber: priorCount + 1,
        submittedAnswer: input.answer,
        submissionType: "text",
        assessment: {
          awardedMarks: assessment.awardedMarks,
          maxMarks: question.maxMarks,
          feedback: assessment.feedback,
          missingPoints: assessment.missingPoints,
          strengths: assessment.strengths,
          confidence: assessment.confidence,
        },
        hintsUsedCount: input.hintsUsed,
        timeSpentSeconds: input.timeSpentSeconds,
      });

      // Add question to session if sessionId provided
      if (input.sessionId) {
        await StudySession.updateOne(
          { $and: [{ _id: new Types.ObjectId(input.sessionId) }, { userId: new Types.ObjectId(ctx.user.userId) }] },
          { $addToSet: { questionIds: question._id } },
        );
      }

      return {
        attemptId: attempt._id.toString(),
        assessment: {
          awardedMarks: assessment.awardedMarks,
          maxMarks: question.maxMarks,
          feedback: assessment.feedback,
          missingPoints: assessment.missingPoints,
          strengths: assessment.strengths,
          confidence: assessment.confidence,
        },
        modelAnswer: question.modelAnswer,
        markSchemePoints: question.markSchemePoints,
      };
    }),

  requestHint: studentProcedure
    .input(requestHintInputModel)
    .output(requestHintOutputModel)
    .mutation(async ({ ctx, input }) => {
      const question = await GeneratedQuestion.findOne({
        $and: [
          { _id: new Types.ObjectId(input.questionId) },
          { userId: new Types.ObjectId(ctx.user.userId) },
        ],
      });
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const nextLevel = input.currentHintLevel + 1;
      if (nextLevel > 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No more hints available" });
      }

      const hintText = question.hints[nextLevel - 1];
      if (!hintText) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Hint not available" });
      }

      await HintEvent.insertOne({
        userId: new Types.ObjectId(ctx.user.userId),
        questionId: question._id,
        moduleId: question.moduleId,
        hintLevel: nextLevel as 1 | 2 | 3 | 4 | 5,
        hintText,
        requestedAt: new Date(),
      });

      return { hintText, hintLevel: nextLevel, isLastHint: nextLevel === 5 };
    }),
});
```

---

## Task 5: tRPC sessions router

**Files:**
- Create: `packages/trpc/src/server/routes/sessions/models.ts`
- Create: `packages/trpc/src/server/routes/sessions/route.ts`

**Step 1: Create models.ts**

Create `packages/trpc/src/server/routes/sessions/models.ts`:
```typescript
import { z } from "zod";

export const startSessionInputModel = z.object({
  moduleId: z.string(),
  mode: z.enum(["theory", "coding", "mixed", "timed", "review"]),
});

export const startSessionOutputModel = z.object({
  sessionId: z.string(),
});

export const endSessionInputModel = z.object({
  sessionId: z.string(),
});

export const endSessionOutputModel = z.object({
  success: z.boolean(),
  summary: z.object({
    questionsAttempted: z.number(),
    averageScore: z.number(),
    hintsUsed: z.number(),
  }),
});
```

**Step 2: Create route.ts**

Create `packages/trpc/src/server/routes/sessions/route.ts`:
```typescript
import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { QuestionAttempt, StudySession } from "@gcse/database";
import { studentProcedure, router } from "../../trpc";
import {
  startSessionInputModel,
  startSessionOutputModel,
  endSessionInputModel,
  endSessionOutputModel,
} from "./models";

export const sessionsRouter = router({
  startSession: studentProcedure
    .input(startSessionInputModel)
    .output(startSessionOutputModel)
    .mutation(async ({ ctx, input }) => {
      const session = await StudySession.insertOne({
        userId: new Types.ObjectId(ctx.user.userId),
        moduleId: new Types.ObjectId(input.moduleId),
        mode: input.mode,
        startedAt: new Date(),
        questionIds: [],
        summary: { questionsAttempted: 0, averageScore: 0, hintsUsed: 0 },
      });
      return { sessionId: session._id.toString() };
    }),

  endSession: studentProcedure
    .input(endSessionInputModel)
    .output(endSessionOutputModel)
    .mutation(async ({ ctx, input }) => {
      const session = await StudySession.findOne({
        $and: [
          { _id: new Types.ObjectId(input.sessionId) },
          { userId: new Types.ObjectId(ctx.user.userId) },
        ],
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });

      const attempts = await QuestionAttempt.find({
        $and: [
          { userId: new Types.ObjectId(ctx.user.userId) },
          { questionId: { $in: session.questionIds } },
        ],
      });

      const questionsAttempted = session.questionIds.length;
      const totalScore = attempts.reduce((sum, a) => sum + a.assessment.awardedMarks, 0);
      const totalMaxScore = attempts.reduce((sum, a) => sum + a.assessment.maxMarks, 0);
      const averageScore = totalMaxScore > 0 ? totalScore / totalMaxScore : 0;
      const hintsUsed = attempts.reduce((sum, a) => sum + a.hintsUsedCount, 0);

      await StudySession.findOneAndUpdate(
        { _id: session._id },
        { $set: { endedAt: new Date(), summary: { questionsAttempted, averageScore, hintsUsed } } },
      );

      return { success: true, summary: { questionsAttempted, averageScore, hintsUsed } };
    }),
});
```

---

## Task 6: tRPC history router

**Files:**
- Create: `packages/trpc/src/server/routes/history/models.ts`
- Create: `packages/trpc/src/server/routes/history/route.ts`

**Step 1: Create models.ts**

Create `packages/trpc/src/server/routes/history/models.ts`:
```typescript
import { z } from "zod";

export const listAttemptsInputModel = z.object({
  moduleId: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  continuationToken: z.string().optional(),
});

const attemptSummaryModel = z.object({
  id: z.string(),
  questionId: z.string(),
  moduleId: z.string(),
  attemptNumber: z.number(),
  submissionType: z.enum(["text", "code"]),
  awardedMarks: z.number(),
  maxMarks: z.number(),
  feedback: z.string(),
  missingPoints: z.array(z.string()),
  strengths: z.array(z.string()),
  hintsUsedCount: z.number(),
  timeSpentSeconds: z.number(),
  createdAt: z.string(),
});

export const listAttemptsOutputModel = z.object({
  attempts: z.array(attemptSummaryModel),
  hasMore: z.boolean(),
  continuationToken: z.string().nullable(),
});

export const getAttemptDetailInputModel = z.object({
  attemptId: z.string(),
});

export const getAttemptDetailOutputModel = z.object({
  id: z.string(),
  questionId: z.string(),
  moduleId: z.string(),
  attemptNumber: z.number(),
  submittedAnswer: z.string(),
  submissionType: z.enum(["text", "code"]),
  assessment: z.object({
    awardedMarks: z.number(),
    maxMarks: z.number(),
    feedback: z.string(),
    missingPoints: z.array(z.string()),
    strengths: z.array(z.string()),
    confidence: z.number(),
  }),
  hintsUsedCount: z.number(),
  timeSpentSeconds: z.number(),
  createdAt: z.string(),
});
```

**Step 2: Create route.ts**

Create `packages/trpc/src/server/routes/history/route.ts`:
```typescript
import { TRPCError } from "@trpc/server";
import { Types } from "mongoose";
import { QuestionAttempt } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import {
  listAttemptsInputModel,
  listAttemptsOutputModel,
  getAttemptDetailInputModel,
  getAttemptDetailOutputModel,
} from "./models";

export const historyRouter = router({
  listAttempts: authenticatedProcedure
    .input(listAttemptsInputModel)
    .output(listAttemptsOutputModel)
    .query(async ({ ctx, input }) => {
      const conditions: object[] = [{ userId: new Types.ObjectId(ctx.user.userId) }];

      if (input.moduleId) {
        conditions.push({ moduleId: new Types.ObjectId(input.moduleId) });
      }
      if (input.continuationToken) {
        conditions.push({ _id: { $lt: new Types.ObjectId(input.continuationToken) } });
      }

      const attempts = await QuestionAttempt.find({ $and: conditions })
        .sort({ createdAt: -1 })
        .limit(input.limit + 1);

      const hasMore = attempts.length > input.limit;
      const toReturn = hasMore ? attempts.slice(0, input.limit) : attempts;
      const nextToken = hasMore ? toReturn[toReturn.length - 1]._id.toString() : null;

      return {
        attempts: toReturn.map((a) => ({
          id: a._id.toString(),
          questionId: a.questionId.toString(),
          moduleId: a.moduleId.toString(),
          attemptNumber: a.attemptNumber,
          submissionType: a.submissionType,
          awardedMarks: a.assessment.awardedMarks,
          maxMarks: a.assessment.maxMarks,
          feedback: a.assessment.feedback,
          missingPoints: a.assessment.missingPoints,
          strengths: a.assessment.strengths,
          hintsUsedCount: a.hintsUsedCount,
          timeSpentSeconds: a.timeSpentSeconds,
          createdAt: a.createdAt.toString(),
        })),
        hasMore,
        continuationToken: nextToken,
      };
    }),

  getAttemptDetail: authenticatedProcedure
    .input(getAttemptDetailInputModel)
    .output(getAttemptDetailOutputModel)
    .query(async ({ ctx, input }) => {
      const attempt = await QuestionAttempt.findOne({
        $and: [
          { _id: new Types.ObjectId(input.attemptId) },
          { userId: new Types.ObjectId(ctx.user.userId) },
        ],
      });
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });

      return {
        id: attempt._id.toString(),
        questionId: attempt.questionId.toString(),
        moduleId: attempt.moduleId.toString(),
        attemptNumber: attempt.attemptNumber,
        submittedAnswer: attempt.submittedAnswer,
        submissionType: attempt.submissionType,
        assessment: {
          awardedMarks: attempt.assessment.awardedMarks,
          maxMarks: attempt.assessment.maxMarks,
          feedback: attempt.assessment.feedback,
          missingPoints: attempt.assessment.missingPoints,
          strengths: attempt.assessment.strengths,
          confidence: attempt.assessment.confidence,
        },
        hintsUsedCount: attempt.hintsUsedCount,
        timeSpentSeconds: attempt.timeSpentSeconds,
        createdAt: attempt.createdAt.toString(),
      };
    }),
});
```

---

## Task 7: Register new routers + rebuild packages

**Files:**
- Modify: `packages/trpc/src/server/index.ts`

**Step 1: Register all new routers**

Update `packages/trpc/src/server/index.ts`:
```typescript
import { router } from "./trpc";
import { authRouter } from "./routes/auth/route";
import { modulesRouter } from "./routes/modules/route";
import { questionsRouter } from "./routes/questions/route";
import { sessionsRouter } from "./routes/sessions/route";
import { historyRouter } from "./routes/history/route";

export const appRouter = router({
  auth: authRouter,
  modules: modulesRouter,
  questions: questionsRouter,
  sessions: sessionsRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, authenticatedProcedure, parentOnlyProcedure, studentProcedure } from "./trpc";
export { createContext } from "./context";
export type { Context, JWTPayload, TRPCContext } from "./context";
```

**Step 2: Build all packages**

```bash
cd /path/to/gcse-coding
pnpm --filter @gcse/services build && pnpm --filter @gcse/trpc build
```
Expected: both exit 0 with no TypeScript errors.

---

## Task 8: Frontend hooks

**Files:**
- Create: `apps/web/hooks/api/questions.tsx`
- Create: `apps/web/hooks/api/sessions.tsx`
- Create: `apps/web/hooks/api/history.tsx`

**Step 1: Create questions hooks**

Create `apps/web/hooks/api/questions.tsx`:
```typescript
import { trpc } from "~/trpc/client";

//#region  //*=========== Mutations ===========

export const useGenerateQuestion = () => {
  return trpc.questions.generateQuestion.useMutation();
};

export const useSubmitAnswer = () => {
  const utils = trpc.useUtils();
  return trpc.questions.submitAnswer.useMutation({
    onSuccess: async () => {
      await utils.history.listAttempts.invalidate();
    },
  });
};

export const useRequestHint = () => {
  return trpc.questions.requestHint.useMutation();
};

//#endregion  //*======== Mutations ===========
```

**Step 2: Create sessions hooks**

Create `apps/web/hooks/api/sessions.tsx`:
```typescript
import { trpc } from "~/trpc/client";

//#region  //*=========== Mutations ===========

export const useStartSession = () => {
  return trpc.sessions.startSession.useMutation();
};

export const useEndSession = () => {
  return trpc.sessions.endSession.useMutation();
};

//#endregion  //*======== Mutations ===========
```

**Step 3: Create history hooks**

Create `apps/web/hooks/api/history.tsx`:
```typescript
import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useListAttempts = (filters?: { moduleId?: string; limit?: number }) => {
  const query = trpc.history.listAttempts.useQuery(
    { moduleId: filters?.moduleId, limit: filters?.limit ?? 20 },
    { enabled: true },
  );
  return {
    attempts: query.data?.attempts ?? [],
    hasMore: query.data?.hasMore ?? false,
    continuationToken: query.data?.continuationToken ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useGetAttemptDetail = (attemptId: string) => {
  const query = trpc.history.getAttemptDetail.useQuery(
    { attemptId },
    { enabled: !!attemptId },
  );
  return {
    attempt: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

//#endregion  //*======== Queries ===========
```

---

## Task 9: Module detail page (mode picker + start session)

**Files:**
- Modify: `apps/web/app/(dashboard)/modules/[id]/page.tsx`

**Step 1: Replace placeholder with real page**

Replace `apps/web/app/(dashboard)/modules/[id]/page.tsx` entirely:
```typescript
"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGetModule } from "~/hooks/api/modules";
import { useStartSession } from "~/hooks/api/sessions";

const TOPIC_TYPE_LABEL: Record<string, string> = {
  theory: "Theory",
  programming: "Coding",
  mixed: "Mixed",
};

const DIFFICULTY_COLOUR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const { module, isLoading } = useGetModule(moduleId);
  const startSession = useStartSession();

  const handleStart = async (mode: "theory") => {
    const { sessionId } = await startSession.mutateAsync({ moduleId, mode });
    router.push(`/modules/${moduleId}/practice?sessionId=${sessionId}&mode=${mode}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/2" />
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-24 bg-slate-200 rounded" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">Module not found</p>
        <Link href="/dashboard" className="text-indigo-600 text-sm mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-600 mb-6 inline-block">
        ← Dashboard
      </Link>

      {/* Module header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
            {module.moduleCode}
          </span>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {TOPIC_TYPE_LABEL[module.topicType] ?? module.topicType}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{module.moduleName}</h1>
        <p className="text-slate-500 mt-1">{module.topicName}</p>
        <p className="text-slate-600 mt-3 text-sm leading-relaxed">{module.description}</p>

        {/* Difficulty bands */}
        {module.difficultyBands?.length > 0 && (
          <div className="flex gap-2 mt-4">
            {module.difficultyBands.map((d) => (
              <span
                key={d}
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${DIFFICULTY_COLOUR[d] ?? "bg-slate-100 text-slate-600"}`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Practice mode picker */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Choose practice mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Theory — active */}
          <button
            onClick={() => handleStart("theory")}
            disabled={startSession.isPending}
            className="flex flex-col items-start p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
          >
            <span className="text-2xl mb-2">📖</span>
            <span className="font-semibold text-slate-900">Theory</span>
            <span className="text-xs text-slate-500 mt-1">Short-answer & extended questions</span>
          </button>

          {/* Coding — coming in Phase 3 */}
          <div className="flex flex-col items-start p-5 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed">
            <span className="text-2xl mb-2">💻</span>
            <span className="font-semibold text-slate-600">Coding</span>
            <span className="text-xs text-slate-400 mt-1">Coming in Phase 3</span>
          </div>

          {/* Mixed — coming in Phase 3 */}
          <div className="flex flex-col items-start p-5 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed">
            <span className="text-2xl mb-2">🔀</span>
            <span className="font-semibold text-slate-600">Mixed</span>
            <span className="text-xs text-slate-400 mt-1">Coming in Phase 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 10: Theory practice page

**Files:**
- Create: `apps/web/app/(dashboard)/modules/[id]/practice/page.tsx`

This page loads a question, lets the student answer it, request hints, and submit. After submission it shows feedback inline and lets them continue or end the session.

Create `apps/web/app/(dashboard)/modules/[id]/practice/page.tsx`:
```typescript
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useGenerateQuestion, useSubmitAnswer, useRequestHint } from "~/hooks/api/questions";
import { useEndSession } from "~/hooks/api/sessions";

type Question = {
  id: string;
  questionText: string;
  maxMarks: number;
  hints: string[];
  metadata: { topicName: string; examBoard: string };
};

type Assessment = {
  awardedMarks: number;
  maxMarks: number;
  feedback: string;
  missingPoints: string[];
  strengths: string[];
};

export default function PracticePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const moduleId = params.id as string;
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [hintsRevealed, setHintsRevealed] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [modelAnswer, setModelAnswer] = useState("");
  const [markSchemePoints, setMarkSchemePoints] = useState<string[]>([]);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQuestion = useGenerateQuestion();
  const submitAnswer = useSubmitAnswer();
  const requestHint = useRequestHint();
  const endSession = useEndSession();

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimeSpent((t) => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const loadQuestion = useCallback(async () => {
    setAnswer("");
    setHintsRevealed([]);
    setAssessment(null);
    setShowModelAnswer(false);
    setModelAnswer("");
    setMarkSchemePoints([]);
    setError("");
    setTimeSpent(0);
    stopTimer();

    try {
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium" });
      setQuestion(q);
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

  const handleHint = async () => {
    if (!question || hintsRevealed.length >= 5) return;
    try {
      const { hintText } = await requestHint.mutateAsync({
        questionId: question.id,
        currentHintLevel: hintsRevealed.length,
      });
      setHintsRevealed((prev) => [...prev, hintText]);
    } catch {
      setError("Could not load hint.");
    }
  };

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;
    stopTimer();
    try {
      const result = await submitAnswer.mutateAsync({
        questionId: question.id,
        sessionId,
        answer: answer.trim(),
        hintsUsed: hintsRevealed.length,
        timeSpentSeconds: timeSpent,
      });
      setAssessment(result.assessment);
      setModelAnswer(result.modelAnswer);
      setMarkSchemePoints(result.markSchemePoints);
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
        <div className="h-32 bg-slate-200 rounded" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="max-w-2xl text-center py-16">
        <p className="text-slate-500">{error}</p>
        <button
          onClick={loadQuestion}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
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
          <p className="text-xs text-slate-400 uppercase tracking-wide">Theory Practice</p>
          <p className="text-sm text-slate-500">{question?.metadata.topicName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 tabular-nums">{formatTime(timeSpent)}</span>
          <button
            onClick={handleEndSession}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
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
              {hintsRevealed.map((hint, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <span className="text-xs font-semibold text-amber-700 mr-2">Hint {i + 1}</span>
                  <span className="text-sm text-amber-800">{hint}</span>
                </div>
              ))}
            </div>
          )}

          {/* Answer area or feedback */}
          {!assessment ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-4"
              />

              {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}

              <div className="flex items-center gap-3">
                {/* Hint button */}
                <button
                  onClick={handleHint}
                  disabled={requestHint.isPending || hintsRevealed.length >= 5}
                  className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestHint.isPending
                    ? "Loading..."
                    : hintsRevealed.length === 0
                      ? "Get hint"
                      : hintsRevealed.length < 5
                        ? `Hint ${hintsRevealed.length + 1} of 5`
                        : "No more hints"}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitAnswer.isPending || !answer.trim()}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitAnswer.isPending ? "Marking..." : "Submit answer"}
                </button>
              </div>
            </>
          ) : (
            /* Feedback panel */
            <div className="space-y-4">
              {/* Score */}
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

              {/* Strengths */}
              {assessment.strengths.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                    What you got right
                  </p>
                  <ul className="space-y-1">
                    {assessment.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-800 flex gap-2">
                        <span>✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing points */}
              {assessment.missingPoints.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
                    Missing points
                  </p>
                  <ul className="space-y-1">
                    {assessment.missingPoints.map((p, i) => (
                      <li key={i} className="text-sm text-rose-800 flex gap-2">
                        <span>✗</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Model answer toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <button
                  onClick={() => setShowModelAnswer((v) => !v)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {showModelAnswer ? "Hide model answer ▲" : "Show model answer ▼"}
                </button>
                {showModelAnswer && (
                  <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {modelAnswer}
                  </p>
                )}
                {showModelAnswer && markSchemePoints.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Mark scheme
                    </p>
                    <ol className="space-y-1">
                      {markSchemePoints.map((point, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-2">
                          <span className="font-semibold text-slate-400">{i + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Next / End actions */}
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

---

## Task 11: History page

**Files:**
- Modify: `apps/web/app/(dashboard)/history/page.tsx`

Replace the placeholder with a real history page:
```typescript
"use client";
import Link from "next/link";
import { useListAttempts } from "~/hooks/api/history";
import { useListModules } from "~/hooks/api/modules";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HistoryPage() {
  const { attempts, isLoading } = useListAttempts({ limit: 20 });
  const { modules } = useListModules();

  const moduleMap = Object.fromEntries(modules.map((m) => [m.id, m]));

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">History</h1>
        <p className="text-slate-500 mt-1">Your past question attempts</p>
      </div>

      {attempts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No attempts yet</p>
          <p className="text-sm mt-1">Start practising to see your history here</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800"
          >
            Go to dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const mod = moduleMap[attempt.moduleId];
            const pct = attempt.maxMarks > 0 ? attempt.awardedMarks / attempt.maxMarks : 0;
            const scoreColour =
              pct === 1
                ? "text-emerald-600 bg-emerald-50"
                : pct >= 0.5
                  ? "text-amber-600 bg-amber-50"
                  : "text-rose-600 bg-rose-50";

            return (
              <div
                key={attempt.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
              >
                {/* Score badge */}
                <div
                  className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-sm ${scoreColour}`}
                >
                  <span className="text-lg leading-none">{attempt.awardedMarks}</span>
                  <span className="text-xs opacity-70">/{attempt.maxMarks}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">
                    {mod?.moduleName ?? "Module"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {mod?.topicName ?? ""}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400">{formatDate(attempt.createdAt)}</span>
                    {attempt.hintsUsedCount > 0 && (
                      <span className="text-xs text-amber-500">
                        {attempt.hintsUsedCount} hint{attempt.hintsUsedCount > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatTime(attempt.timeSpentSeconds)}</span>
                  </div>
                </div>

                {/* Attempt number */}
                {attempt.attemptNumber > 1 && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    Attempt #{attempt.attemptNumber}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## Task 12: End-to-end smoke test

**Step 1: Rebuild and restart the Docker stack**

```bash
cd /path/to/gcse-coding
docker compose down && docker compose up --build -d
```

Wait ~60s for all services to start, then:
```bash
docker compose logs api --tail=30
```
Expected: `API running on http://localhost:3001` with no errors.

**Step 2: Verify API health**

```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok"}`

**Step 3: End-to-end browser test**

Open `http://localhost:3000` in a browser and follow this sequence:

1. Sign up as a parent: full name, email, password, select **Balanced** AI model
2. Create a student: full name, student email/password, exam board **OCR**
3. Sign out, then sign in as the student
4. On the dashboard, click a module card (e.g. "Programming Fundamentals")
5. Verify the module detail page shows: module name, description, difficulty badges, mode picker
6. Click **Theory** — should navigate to `/modules/[id]/practice?sessionId=...&mode=theory`
7. A question should load after a few seconds (AI call)
8. Type any answer in the textarea
9. Click **Get hint** — verify a hint appears
10. Click **Submit answer** — verify feedback appears with marks, strengths, missing points
11. Click **Show model answer** — verify it expands
12. Click **Next question →** — verify a new question loads
13. Click **End session** — should redirect to dashboard
14. Click **History** in nav — verify the attempt(s) appear with score badges

**Step 4: Verify error cases**

- Try submitting with an empty answer — button should be disabled
- Try clicking "Get hint" after all 5 hints revealed — button should disable

---

## Troubleshooting

**"ANTHROPIC_API_KEY not set" error:** Add key to `apps/api/.env` and restart API (`docker compose restart api`)

**"Module not found" in question generation:** Ensure seed ran — check `docker compose logs api` for "Seeding..." message. If seed didn't run, `docker compose restart api`.

**TypeScript errors in trpc package:** Run `pnpm --filter @gcse/services build` first, then `pnpm --filter @gcse/trpc build`. The trpc package depends on compiled services.

**pnpm install fails after adding `@anthropic-ai/sdk`:** Run `pnpm install --no-frozen-lockfile` once to update the lockfile, then subsequent `pnpm install` or `--frozen-lockfile` will work.

**Next.js dev server stale types:** After rebuilding trpc package, restart the Next.js dev server: `pnpm --filter web dev` (or `docker compose up --build web`).
