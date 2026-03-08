# Theory/Coding Question Separation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce strict separation so theory practice never generates coding questions and coding practice never generates theory questions.

**Architecture:** Add a `mode` parameter ("theory" | "coding") that flows from the frontend page through tRPC to the service layer, where it filters both cached questions and templates by answer type, and constrains AI prompts.

**Tech Stack:** TypeScript, Zod, tRPC, Anthropic AI SDK, Next.js React

---

### Task 1: Add `mode` to service-layer input schema

**Files:**
- Modify: `packages/services/src/question-generation-service/models.ts:3-8`

**Step 1: Add mode field to generateQuestionInput**

Add `mode` as an optional enum field:

```typescript
export const generateQuestionInput = z.object({
  moduleId: z.string(),
  userId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  mode: z.enum(["theory", "coding"]).optional(),
});
```

No other changes needed — `GenerateQuestionInput` type auto-derives from this.

---

### Task 2: Add `mode` to tRPC input schema and forward to service

**Files:**
- Modify: `packages/trpc/src/server/routes/questions/models.ts:3-7`
- Modify: `packages/trpc/src/server/routes/questions/route.ts:30-37`

**Step 1: Add mode to tRPC input model**

In `models.ts`, add mode to `generateQuestionInputModel`:

```typescript
export const generateQuestionInputModel = z.object({
  moduleId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  mode: z.enum(["theory", "coding"]).optional(),
});
```

**Step 2: Forward mode in the tRPC route**

In `route.ts`, update the `generateQuestion` mutation to pass `mode`:

```typescript
  generateQuestion: studentProcedure
    .input(generateQuestionInputModel)
    .output(generatedQuestionOutputModel)
    .mutation(async ({ ctx, input }) => {
      return questionGenSvc.generateQuestion({
        moduleId: input.moduleId,
        userId: ctx.user!.userId,
        difficulty: input.difficulty,
        examBoard: input.examBoard,
        mode: input.mode,
      });
    }),
```

---

### Task 3: Update QuestionGenerationService to filter by mode

**Files:**
- Modify: `packages/services/src/question-generation-service/index.ts`

This is the core change. Three areas need updating:

**Step 1: Add type constants at the top of the file (after imports, before the class)**

```typescript
const THEORY_QUESTION_TYPES = [
  "multiple_choice",
  "short_answer",
  "extended",
  "trace_table",
  "fill_gap",
  "predict_output",
] as const;

const CODING_QUESTION_TYPES = ["coding", "fix_code"] as const;
```

**Step 2: Filter cached questions by mode**

In `generateQuestion()`, after line 17 (`const { moduleId, userId, difficulty = "medium", examBoard } = input;`), add mode extraction:

```typescript
const { moduleId, userId, difficulty = "medium", examBoard, mode } = input;
```

Then update the cache query (the `cacheConditions` array, currently lines 18-34). After the existing conditions and before `const cached = ...`, add a mode filter:

```typescript
    if (mode === "theory") {
      cacheConditions.push({ answerFormat: "free_text" });
    } else if (mode === "coding") {
      cacheConditions.push({ answerFormat: "code" });
    }
```

**Step 3: Filter templates by mode**

Replace the template query (lines 48-55) with mode-aware filtering:

```typescript
    // 3. Find a matching template
    const templateConditions: object[] = [
      {
        moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId,
      },
      { active: true },
    ];
    if (mode === "theory") {
      templateConditions.push({ questionType: { $in: THEORY_QUESTION_TYPES } });
    } else if (mode === "coding") {
      templateConditions.push({ questionType: { $in: CODING_QUESTION_TYPES } });
    }
    const template = await QuestionTemplate.findOne({ $and: templateConditions });
```

**Step 4: Update the fallback default and isCoding flag**

Replace line 64 (`const isCoding = template?.questionType === "coding";`) and line 69 (`questionType: template?.questionType ?? "short_answer",`) with mode-aware logic:

```typescript
    const isCoding =
      mode === "coding" ||
      (!mode && (template?.questionType === "coding" || template?.questionType === "fix_code"));
```

And for the questionType default on the saved document:

```typescript
      questionType: template?.questionType ?? (isCoding ? "coding" : "short_answer"),
```

---

### Task 4: Update AI system prompts to enforce separation

**Files:**
- Modify: `packages/services/src/question-generation-service/index.ts` (the `callAI` method)

**Step 1: Add guardrail rules to the theory prompt**

In the theory system prompt (lines 140-154), add this rule after the existing rules:

```
- IMPORTANT: Do NOT ask the student to write any programs or code. Questions must test conceptual understanding, recall, and analysis only. The student answers in plain text, not code.
```

The full theory prompt becomes:

```typescript
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
- modelAnswer must address all mark scheme points
- IMPORTANT: Do NOT ask the student to write any programs or code. Questions must test conceptual understanding, recall, and analysis only. The student answers in plain text, not code.`;
```

**Step 2: Add guardrail rule to the coding prompt**

In the coding system prompt (lines 119-139), add after the existing rules:

```
- IMPORTANT: The question MUST require the student to write a Python program. Do not ask theory-only or explanation questions.
```

The full coding prompt becomes:

```typescript
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
  "markSchemePoints": ["point 1 per mark"],
  "modelAnswer": "def solution(n):\\n    return n * n",
  "hints": ["hint 1", "hint 2", "hint 3", "hint 4", "hint 5"],
  "misconceptionNotes": ["common mistake"]
}
Rules:
- testCases: minimum 2 visible (hidden: false) + 1 hidden (hidden: true)
- number of markSchemePoints must equal maxMarks
- hints: exactly 5, progressively more helpful; hint 5 is pseudocode/structure, never full solution
- modelAnswer: working Python code
- IMPORTANT: The question MUST require the student to write a Python program. Do not ask theory-only or explanation questions.`
```

---

### Task 5: Frontend pages pass mode to generateQuestion

**Files:**
- Modify: `apps/web/app/(dashboard)/modules/[id]/practice/page.tsx:72`
- Modify: `apps/web/app/(dashboard)/modules/[id]/coding/page.tsx:85`

**Step 1: Theory practice page**

Change line 72 from:
```typescript
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium" });
```
To:
```typescript
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium", mode: "theory" });
```

**Step 2: Coding practice page**

Change line 85 from:
```typescript
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium" });
```
To:
```typescript
      const q = await generateQuestion.mutateAsync({ moduleId, difficulty: "medium", mode: "coding" });
```

---

## Summary of changes

| File | Change |
|------|--------|
| `packages/services/src/question-generation-service/models.ts` | Add `mode` to input schema |
| `packages/services/src/question-generation-service/index.ts` | Add type constants, filter cache + templates by mode, update isCoding logic, add AI prompt guardrails |
| `packages/trpc/src/server/routes/questions/models.ts` | Add `mode` to tRPC input schema |
| `packages/trpc/src/server/routes/questions/route.ts` | Forward `mode` to service |
| `apps/web/app/(dashboard)/modules/[id]/practice/page.tsx` | Pass `mode: "theory"` |
| `apps/web/app/(dashboard)/modules/[id]/coding/page.tsx` | Pass `mode: "coding"` |
