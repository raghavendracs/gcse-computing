# Phase 4 — Progress & Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a materialized progress system with streak tracking, weak area detection, spaced repetition, and full attempt history drill-down.

**Architecture:** Hybrid — a `student_progress` collection stores pre-aggregated per-student summaries (upserted on every `submitAnswer`); history queries hit `question_attempts` directly with pagination; spaced repetition lives on `generated_questions.nextReviewAt`.

**Tech Stack:** MongoDB + Mongoose, tRPC, Zod, Vitest, Next.js, Tailwind CSS, TanStack Query via tRPC.

---

## What Already Exists (DO NOT recreate)

- `packages/trpc/src/server/routes/history/` — `listAttempts` + `getAttemptDetail` routes exist but `getAttemptDetail` needs enrichment with question context
- `apps/web/hooks/api/history.tsx` — `useListAttempts` + `useGetAttemptDetail` hooks exist
- `apps/web/app/(dashboard)/history/page.tsx` — basic list view (needs drill-down)
- `apps/web/app/(dashboard)/progress/page.tsx` — placeholder only (needs full impl)
- `apps/web/components/nav.tsx` — already has Progress + History nav links
- `packages/trpc/src/server/index.ts` — already registers `historyRouter`

## Run commands from

All `pnpm` commands: run from `/Users/raghucs/2026-Projects/gsce-coding/`
All service tests: `pnpm --filter @gcse/services test`
TypeScript checks: `pnpm --filter @gcse/services build` and `pnpm --filter @gcse/trpc build`

---

## Task 1: `student_progress` DB model

**Files:**
- Create: `packages/database/src/models/student-progress.ts`
- Modify: `packages/database/src/index.ts`

**Step 1: Create the model**

`packages/database/src/models/student-progress.ts`:
```typescript
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IModuleWeakAreaFlags {
  hintDependent: boolean;
  lowAccuracy: boolean;
  errorProne: boolean;
}

export interface IModuleProgress {
  moduleId: Types.ObjectId;
  moduleName: string;
  totalAttempts: number;
  averageScore: number;
  lastAttemptAt: Date;
  hintsPerQuestion: number;
  weakAreaFlags: IModuleWeakAreaFlags;
}

export interface IWeakArea {
  moduleId: Types.ObjectId;
  moduleName: string;
  reasons: string[];
  suggestedAction: string;
}

export interface IStudentProgress extends BaseMongodbSchema {
  userId: Types.ObjectId;
  streak: {
    currentDays: number;
    lastActivityDate: Date;
  };
  moduleProgress: IModuleProgress[];
  weakAreas: IWeakArea[];
  totalAttempts: number;
}

const studentProgressSchema = new Schema<IStudentProgress>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    streak: {
      currentDays: { type: Number, default: 1 },
      lastActivityDate: { type: Date, required: true },
    },
    moduleProgress: [
      {
        moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
        moduleName: { type: String, required: true },
        totalAttempts: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, required: true },
        hintsPerQuestion: { type: Number, default: 0 },
        weakAreaFlags: {
          hintDependent: { type: Boolean, default: false },
          lowAccuracy: { type: Boolean, default: false },
          errorProne: { type: Boolean, default: false },
        },
      },
    ],
    weakAreas: [
      {
        moduleId: { type: Schema.ObjectId, required: true },
        moduleName: { type: String, required: true },
        reasons: [{ type: String }],
        suggestedAction: { type: String, required: true },
      },
    ],
    totalAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

studentProgressSchema.index({ userId: 1 }, { unique: true });

export const StudentProgress = model<IStudentProgress>(
  "student_progress",
  studentProgressSchema,
);
export default StudentProgress;
```

**Step 2: Export from database index**

Add to `packages/database/src/index.ts` (after existing exports):
```typescript
export { StudentProgress } from "./models/student-progress";
export type { IStudentProgress, IModuleProgress, IWeakArea, IModuleWeakAreaFlags } from "./models/student-progress";
```

**Step 3: Build to verify no type errors**

```bash
pnpm --filter @gcse/database build
```
Expected: exits 0, no TypeScript errors.

---

## Task 2: Add `nextReviewAt` to `generated_questions`

**Files:**
- Modify: `packages/database/src/models/generated-question.ts`

**Step 1: Add field to interface**

In `IGeneratedQuestion`, after `usedInSession: boolean;`, add:
```typescript
nextReviewAt?: Date;
```

**Step 2: Add field to schema**

In `generatedQuestionSchema`, after the `usedInSession` field definition, add:
```typescript
nextReviewAt: { type: Date, required: false },
```

**Step 3: Add index**

After the existing indexes, add:
```typescript
generatedQuestionSchema.index({ userId: 1, nextReviewAt: 1 });
```

**Step 4: Build**

```bash
pnpm --filter @gcse/database build
```
Expected: exits 0.

---

## Task 3: Progress service with streak + weak area logic

**Files:**
- Create: `packages/services/src/progress-service/models.ts`
- Create: `packages/services/src/progress-service/index.ts`
- Create: `packages/services/src/progress-service/__tests__/progress-service.test.ts`
- Modify: `packages/services/src/index.ts`

**Step 1: Write the failing tests first**

`packages/services/src/progress-service/__tests__/progress-service.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeStreak, computeWeakAreaFlags, buildSuggestedAction } from "../index";

// ── Streak ────────────────────────────────────────────────────────────────────

describe("computeStreak", () => {
  const today = new Date("2026-03-07");

  it("increments streak when last activity was yesterday", () => {
    const yesterday = new Date("2026-03-06");
    const result = computeStreak(3, yesterday, today);
    expect(result).toBe(4);
  });

  it("keeps streak when last activity is today", () => {
    const result = computeStreak(5, today, today);
    expect(result).toBe(5);
  });

  it("resets streak to 1 when last activity was 2 days ago", () => {
    const twoDaysAgo = new Date("2026-03-05");
    const result = computeStreak(7, twoDaysAgo, today);
    expect(result).toBe(1);
  });

  it("resets streak to 1 when no prior activity", () => {
    const result = computeStreak(0, new Date("2020-01-01"), today);
    expect(result).toBe(1);
  });
});

// ── Weak area flags ───────────────────────────────────────────────────────────

describe("computeWeakAreaFlags", () => {
  it("flags lowAccuracy when averageScore < 50", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 40,
      hintsPerQuestion: 1,
      totalAttempts: 5,
      errorProneFraction: 0,
    });
    expect(flags.lowAccuracy).toBe(true);
    expect(flags.hintDependent).toBe(false);
  });

  it("flags hintDependent when hintsPerQuestion > 2", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 70,
      hintsPerQuestion: 3,
      totalAttempts: 5,
      errorProneFraction: 0,
    });
    expect(flags.hintDependent).toBe(true);
    expect(flags.lowAccuracy).toBe(false);
  });

  it("flags errorProne when >30% of attempts have errors", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 70,
      hintsPerQuestion: 1,
      totalAttempts: 5,
      errorProneFraction: 0.4,
    });
    expect(flags.errorProne).toBe(true);
  });

  it("no flags when stats are healthy", () => {
    const flags = computeWeakAreaFlags({
      averageScore: 80,
      hintsPerQuestion: 1,
      totalAttempts: 5,
      errorProneFraction: 0.1,
    });
    expect(flags.lowAccuracy).toBe(false);
    expect(flags.hintDependent).toBe(false);
    expect(flags.errorProne).toBe(false);
  });
});

// ── Suggested action ──────────────────────────────────────────────────────────

describe("buildSuggestedAction", () => {
  it("returns low accuracy suggestion when only lowAccuracy flagged", () => {
    const action = buildSuggestedAction({ lowAccuracy: true, hintDependent: false, errorProne: false });
    expect(action).toContain("easy");
  });

  it("returns hint suggestion when only hintDependent flagged", () => {
    const action = buildSuggestedAction({ lowAccuracy: false, hintDependent: true, errorProne: false });
    expect(action).toContain("hint");
  });

  it("returns error suggestion when only errorProne flagged", () => {
    const action = buildSuggestedAction({ lowAccuracy: false, hintDependent: false, errorProne: true });
    expect(action).toContain("syntax");
  });
});
```

**Step 2: Run tests — verify they fail**

```bash
pnpm --filter @gcse/services test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|cannot find"
```
Expected: FAIL — functions not found.

**Step 3: Create models.ts**

`packages/services/src/progress-service/models.ts`:
```typescript
import { z } from "zod";

export const updateProgressPayload = z.object({
  userId: z.string(),
  moduleId: z.string(),
  moduleName: z.string(),
  awardedMarks: z.number(),
  maxMarks: z.number(),
  hintsUsed: z.number(),
  submissionType: z.enum(["text", "code"]),
  hadError: z.boolean(),
});

export type UpdateProgressPayload = z.infer<typeof updateProgressPayload>;
```

**Step 4: Create index.ts**

`packages/services/src/progress-service/index.ts`:
```typescript
import { Types } from "mongoose";
import { StudentProgress } from "@gcse/database";
import { updateProgressPayload, UpdateProgressPayload } from "./models";

// ── Pure helper functions (exported for unit testing) ─────────────────────────

/**
 * Compute new streak given prior state and today's date.
 * Uses date-only comparison (ignores time).
 */
export function computeStreak(
  currentDays: number,
  lastActivityDate: Date,
  today: Date,
): number {
  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);

  const diffDays = Math.round((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return currentDays;          // already counted today
  if (diffDays === 1) return currentDays + 1;      // consecutive day
  return 1;                                         // gap — reset
}

export interface WeakAreaInput {
  averageScore: number;
  hintsPerQuestion: number;
  totalAttempts: number;
  errorProneFraction: number;
}

export function computeWeakAreaFlags(input: WeakAreaInput) {
  return {
    lowAccuracy: input.averageScore < 50,
    hintDependent: input.hintsPerQuestion > 2,
    errorProne: input.errorProneFraction > 0.3,
  };
}

export function buildSuggestedAction(flags: {
  lowAccuracy: boolean;
  hintDependent: boolean;
  errorProne: boolean;
}): string {
  if (flags.errorProne) return "Review syntax rules and trace through your code before running it";
  if (flags.lowAccuracy && flags.hintDependent) return "Attempt questions without hints first — use easy difficulty to rebuild confidence";
  if (flags.lowAccuracy) return "Try easy difficulty to strengthen the basics before moving up";
  if (flags.hintDependent) return "Attempt without hints — use them only when genuinely stuck";
  return "Keep practising to consolidate this topic";
}

// ── Service class ─────────────────────────────────────────────────────────────

class ProgressService {
  async updateAfterAttempt(payload: UpdateProgressPayload): Promise<void> {
    const input = await updateProgressPayload.parseAsync(payload);
    const userId = new Types.ObjectId(input.userId);
    const moduleId = new Types.ObjectId(input.moduleId);
    const now = new Date();
    const scorePercent = input.maxMarks > 0
      ? (input.awardedMarks / input.maxMarks) * 100
      : 0;

    // Fetch existing doc (if any) to compute rolling averages
    const existing = await StudentProgress.findOne({ userId });

    // Compute new streak
    const prevStreak = existing?.streak ?? { currentDays: 0, lastActivityDate: new Date(0) };
    const newStreakDays = computeStreak(prevStreak.currentDays, prevStreak.lastActivityDate, now);

    // Find existing module entry
    const existingModule = existing?.moduleProgress.find(
      (m) => m.moduleId.toString() === moduleId.toString(),
    );

    const prevTotal = existingModule?.totalAttempts ?? 0;
    const prevAvg = existingModule?.averageScore ?? 0;
    const prevHints = existingModule?.hintsPerQuestion ?? 0;

    // Rolling averages
    const newTotal = prevTotal + 1;
    const newAvg = ((prevAvg * prevTotal) + scorePercent) / newTotal;
    const newHints = ((prevHints * prevTotal) + input.hintsUsed) / newTotal;

    // Error prone fraction: tracked via a running count stored implicitly
    // We approximate by re-computing with the new data point
    const prevErrorFrac = existingModule?.weakAreaFlags.errorProne
      ? prevTotal > 0 ? 0.4 : 0   // rough: if flagged, was >30%
      : 0;
    const newErrorCount = (prevErrorFrac * prevTotal) + (input.hadError ? 1 : 0);
    const newErrorFrac = newTotal > 0 ? newErrorCount / newTotal : 0;

    const flags = computeWeakAreaFlags({
      averageScore: newAvg,
      hintsPerQuestion: newHints,
      totalAttempts: newTotal,
      errorProneFraction: newErrorFrac,
    });

    const moduleEntry = {
      moduleId,
      moduleName: input.moduleName,
      totalAttempts: newTotal,
      averageScore: Math.round(newAvg * 10) / 10,
      lastAttemptAt: now,
      hintsPerQuestion: Math.round(newHints * 10) / 10,
      weakAreaFlags: flags,
    };

    if (!existing) {
      // First attempt ever — create document
      const weakAreas = (flags.lowAccuracy || flags.hintDependent || flags.errorProne) && newTotal >= 3
        ? [buildWeakArea(moduleId, input.moduleName, flags)]
        : [];

      await StudentProgress.insertOne({
        userId,
        streak: { currentDays: 1, lastActivityDate: now },
        moduleProgress: [moduleEntry],
        weakAreas,
        totalAttempts: 1,
      });
      return;
    }

    // Update existing module entry or push new one
    const hasModule = existing.moduleProgress.some(
      (m) => m.moduleId.toString() === moduleId.toString(),
    );

    if (hasModule) {
      await StudentProgress.updateOne(
        { userId, "moduleProgress.moduleId": moduleId },
        {
          $set: {
            "moduleProgress.$": moduleEntry,
            "streak.currentDays": newStreakDays,
            "streak.lastActivityDate": now,
          },
          $inc: { totalAttempts: 1 },
        },
      );
    } else {
      await StudentProgress.updateOne(
        { userId },
        {
          $push: { moduleProgress: moduleEntry },
          $set: {
            "streak.currentDays": newStreakDays,
            "streak.lastActivityDate": now,
          },
          $inc: { totalAttempts: 1 },
        },
      );
    }

    // Recompute weak areas across all modules
    const updated = await StudentProgress.findOne({ userId });
    if (!updated) return;

    const newWeakAreas = updated.moduleProgress
      .filter((m) => {
        const { lowAccuracy, hintDependent, errorProne } = m.weakAreaFlags;
        return (lowAccuracy || hintDependent || errorProne) && m.totalAttempts >= 3;
      })
      .map((m) => buildWeakArea(m.moduleId, m.moduleName, m.weakAreaFlags));

    await StudentProgress.updateOne({ userId }, { $set: { weakAreas: newWeakAreas } });
  }

  async getSummary(userId: string) {
    const doc = await StudentProgress.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!doc) return null;
    return doc;
  }
}

function buildWeakArea(
  moduleId: Types.ObjectId,
  moduleName: string,
  flags: { lowAccuracy: boolean; hintDependent: boolean; errorProne: boolean },
) {
  const reasons: string[] = [];
  if (flags.lowAccuracy) reasons.push("Low accuracy");
  if (flags.hintDependent) reasons.push("Heavy hint use");
  if (flags.errorProne) reasons.push("Frequent errors");
  return {
    moduleId,
    moduleName,
    reasons,
    suggestedAction: buildSuggestedAction(flags),
  };
}

export default ProgressService;
```

**Step 5: Run tests — verify they pass**

```bash
pnpm --filter @gcse/services test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|×"
```
Expected: all progress-service tests PASS.

**Step 6: Export from services index**

Add to `packages/services/src/index.ts`:
```typescript
export { default as ProgressService } from "./progress-service/index";
```

**Step 7: Build services**

```bash
pnpm --filter @gcse/services build
```
Expected: exits 0.

---

## Task 4: Progress tRPC route

**Files:**
- Create: `packages/trpc/src/server/routes/progress/models.ts`
- Create: `packages/trpc/src/server/routes/progress/route.ts`
- Modify: `packages/trpc/src/server/index.ts`

**Step 1: Create models.ts**

`packages/trpc/src/server/routes/progress/models.ts`:
```typescript
import { z } from "zod";

const moduleWeakAreaFlagsModel = z.object({
  hintDependent: z.boolean(),
  lowAccuracy: z.boolean(),
  errorProne: z.boolean(),
});

const moduleProgressModel = z.object({
  moduleId: z.string(),
  moduleName: z.string(),
  totalAttempts: z.number(),
  averageScore: z.number(),
  lastAttemptAt: z.string(),
  hintsPerQuestion: z.number(),
  weakAreaFlags: moduleWeakAreaFlagsModel,
});

const weakAreaModel = z.object({
  moduleId: z.string(),
  moduleName: z.string(),
  reasons: z.array(z.string()),
  suggestedAction: z.string(),
});

export const getSummaryOutputModel = z.object({
  streak: z.object({
    currentDays: z.number(),
    lastActivityDate: z.string(),
  }),
  moduleProgress: z.array(moduleProgressModel),
  weakAreas: z.array(weakAreaModel),
  totalAttempts: z.number(),
}).nullable();

export const getModuleProgressInputModel = z.object({
  moduleId: z.string(),
});

export const getModuleProgressOutputModel = moduleProgressModel.nullable();
```

**Step 2: Create route.ts**

`packages/trpc/src/server/routes/progress/route.ts`:
```typescript
import { Types } from "mongoose";
import { StudentProgress } from "@gcse/database";
import { studentProcedure, router } from "../../trpc";
import { getSummaryOutputModel, getModuleProgressInputModel, getModuleProgressOutputModel } from "./models";

export const progressRouter = router({
  getSummary: studentProcedure
    .output(getSummaryOutputModel)
    .query(async ({ ctx }) => {
      const doc = await StudentProgress.findOne({
        userId: new Types.ObjectId(ctx.user!.userId),
      });
      if (!doc) return null;

      return {
        streak: {
          currentDays: doc.streak.currentDays,
          lastActivityDate: doc.streak.lastActivityDate.toString(),
        },
        moduleProgress: doc.moduleProgress.map((m) => ({
          moduleId: m.moduleId.toString(),
          moduleName: m.moduleName,
          totalAttempts: m.totalAttempts,
          averageScore: m.averageScore,
          lastAttemptAt: m.lastAttemptAt.toString(),
          hintsPerQuestion: m.hintsPerQuestion,
          weakAreaFlags: m.weakAreaFlags,
        })),
        weakAreas: doc.weakAreas.map((w) => ({
          moduleId: w.moduleId.toString(),
          moduleName: w.moduleName,
          reasons: w.reasons,
          suggestedAction: w.suggestedAction,
        })),
        totalAttempts: doc.totalAttempts,
      };
    }),

  getModuleProgress: studentProcedure
    .input(getModuleProgressInputModel)
    .output(getModuleProgressOutputModel)
    .query(async ({ ctx, input }) => {
      const doc = await StudentProgress.findOne({
        userId: new Types.ObjectId(ctx.user!.userId),
      });
      if (!doc) return null;

      const entry = doc.moduleProgress.find(
        (m) => m.moduleId.toString() === input.moduleId,
      );
      if (!entry) return null;

      return {
        moduleId: entry.moduleId.toString(),
        moduleName: entry.moduleName,
        totalAttempts: entry.totalAttempts,
        averageScore: entry.averageScore,
        lastAttemptAt: entry.lastAttemptAt.toString(),
        hintsPerQuestion: entry.hintsPerQuestion,
        weakAreaFlags: entry.weakAreaFlags,
      };
    }),
});
```

**Step 3: Register in server/index.ts**

In `packages/trpc/src/server/index.ts`, add:
```typescript
import { progressRouter } from "./routes/progress/route";
```
And add to the router object:
```typescript
progress: progressRouter,
```

**Step 4: Build trpc**

```bash
pnpm --filter @gcse/trpc build
```
Expected: exits 0.

---

## Task 5: Extend `submitAnswer` — update progress + spaced repetition

**Files:**
- Modify: `packages/trpc/src/server/routes/questions/route.ts`

**Step 1: Import ProgressService and StudentProgress**

At the top of `route.ts`, add to the `@gcse/services` import:
```typescript
import { ..., ProgressService } from "@gcse/services";
```
And add:
```typescript
import { Module } from "@gcse/database";
```
(Module is needed to get `moduleName`)

Also instantiate at the top:
```typescript
const progressSvc = new ProgressService();
```

**Step 2: After the attempt is saved (line ~138), add progress update + spaced repetition**

After the block:
```typescript
await GeneratedQuestion.updateOne(
  { _id: question._id },
  { $set: { usedInSession: true } },
);
```

Add:
```typescript
// Fetch module name for progress tracking
const mod = await Module.findOne({ _id: question.moduleId });

// Update student progress (fire-and-forget — don't block response)
if (mod) {
  progressSvc.updateAfterAttempt({
    userId: ctx.user!.userId,
    moduleId: question.moduleId.toString(),
    moduleName: mod.moduleName,
    awardedMarks: assessmentResult.awardedMarks,
    maxMarks: assessmentResult.maxMarks,
    hintsUsed: input.hintsUsed,
    submissionType: question.answerFormat === "code" ? "code" : "text",
    hadError: codingAnalysis?.errorCategory != null,
  }).catch(() => { /* non-blocking */ });
}

// Spaced repetition: retire correctly-answered questions for 7 days
if (assessmentResult.awardedMarks === assessmentResult.maxMarks) {
  const reviewAt = new Date();
  reviewAt.setDate(reviewAt.getDate() + 7);
  await GeneratedQuestion.updateOne(
    { _id: question._id },
    { $set: { nextReviewAt: reviewAt } },
  );
}
```

**Step 3: Build**

```bash
pnpm --filter @gcse/trpc build
```
Expected: exits 0.

---

## Task 6: Spaced repetition in `generateQuestion`

**Files:**
- Modify: `packages/services/src/question-generation-service/index.ts`

**Step 1: Add `nextReviewAt` filter to cache query**

In `generateQuestion`, the cache query currently has:
```typescript
{ usedInSession: false },
```

Replace it with:
```typescript
{ $or: [{ usedInSession: false }, { nextReviewAt: { $lte: new Date() } }] },
// Also exclude questions in active cooldown
```

Wait — the logic is: return a cached question that is EITHER not yet used, OR used but `nextReviewAt` has passed. So replace the two conditions:
```typescript
{ usedInSession: false },
```
with:
```typescript
{
  $or: [
    { usedInSession: false },
    { usedInSession: true, nextReviewAt: { $exists: true, $lte: new Date() } },
  ],
},
```

And add a condition to explicitly exclude questions still in cooldown:
```typescript
{
  $or: [
    { nextReviewAt: { $exists: false } },
    { nextReviewAt: { $lte: new Date() } },
  ],
},
```

The final `cacheConditions` array should be:
```typescript
const cacheConditions: object[] = [
  { userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId },
  { moduleId: Types.ObjectId.isValid(moduleId) ? new Types.ObjectId(moduleId) : moduleId },
  { difficulty },
  {
    $or: [
      { usedInSession: false },
      { usedInSession: true, nextReviewAt: { $exists: true, $lte: new Date() } },
    ],
  },
  {
    $or: [
      { nextReviewAt: { $exists: false } },
      { nextReviewAt: { $lte: new Date() } },
    ],
  },
];
```

**Step 2: Build**

```bash
pnpm --filter @gcse/services build
```
Expected: exits 0.

---

## Task 7: Enhance `getAttemptDetail` with question context

`getAttemptDetail` currently returns the attempt but not `questionText`, `modelAnswer`, or `markSchemePoints`. The design requires full detail — join with `generated_questions`.

**Files:**
- Modify: `packages/trpc/src/server/routes/history/models.ts`
- Modify: `packages/trpc/src/server/routes/history/route.ts`

**Step 1: Extend the output model**

In `packages/trpc/src/server/routes/history/models.ts`, update `getAttemptDetailOutputModel` to add:
```typescript
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
  // Enriched from generated_questions
  questionText: z.string().optional(),
  modelAnswer: z.string().optional(),
  markSchemePoints: z.array(z.string()).optional(),
  hints: z.array(z.string()).optional(),
  hintsUsedCount: z.number(),
  timeSpentSeconds: z.number(),
  createdAt: z.string(),
});
```

**Step 2: Update the route to join with generated_questions**

In `packages/trpc/src/server/routes/history/route.ts`, add `GeneratedQuestion` to the import:
```typescript
import { QuestionAttempt, GeneratedQuestion } from "@gcse/database";
```

Update the `getAttemptDetail` handler to fetch question data:
```typescript
getAttemptDetail: authenticatedProcedure
  .input(getAttemptDetailInputModel)
  .output(getAttemptDetailOutputModel)
  .query(async ({ ctx, input }) => {
    const attempt = await QuestionAttempt.findOne({
      $and: [
        { _id: new Types.ObjectId(input.attemptId) },
        { userId: new Types.ObjectId(ctx.user!.userId) },
      ],
    });
    if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });

    // Fetch question for enriched context
    const question = await GeneratedQuestion.findOne({ _id: attempt.questionId });

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
      questionText: question?.questionText,
      modelAnswer: question?.modelAnswer,
      markSchemePoints: question?.markSchemePoints,
      hints: question?.hints,
      hintsUsedCount: attempt.hintsUsedCount,
      timeSpentSeconds: attempt.timeSpentSeconds,
      createdAt: attempt.createdAt.toString(),
    };
  }),
```

**Step 3: Build**

```bash
pnpm --filter @gcse/trpc build
```
Expected: exits 0.

---

## Task 8: Progress frontend hooks + page

**Files:**
- Create: `apps/web/hooks/api/progress.tsx`
- Replace: `apps/web/app/(dashboard)/progress/page.tsx`

**Step 1: Create progress hooks**

`apps/web/hooks/api/progress.tsx`:
```tsx
import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useGetProgress = () => {
  const query = trpc.progress.getSummary.useQuery(undefined, { enabled: true });
  return {
    progress: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useGetModuleProgress = (moduleId: string) => {
  const query = trpc.progress.getModuleProgress.useQuery(
    { moduleId },
    { enabled: !!moduleId },
  );
  return {
    moduleProgress: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

//#endregion  //*======== Queries ===========
```

**Step 2: Build the progress page**

`apps/web/app/(dashboard)/progress/page.tsx`:
```tsx
"use client";
import Link from "next/link";
import { useGetProgress } from "~/hooks/api/progress";

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const colour =
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-slate-700 w-10 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export default function ProgressPage() {
  const { progress, isLoading } = useGetProgress();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-200 rounded-xl" />
        <div className="h-48 bg-slate-200 rounded-xl" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No progress yet</p>
        <p className="text-sm mt-1">Complete your first question to see progress here</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800">
          Go to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Progress</h1>
        <p className="text-slate-500 mt-1">Your learning overview</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{progress.streak.currentDays}</p>
          <p className="text-xs text-slate-500 mt-1">day streak</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{progress.totalAttempts}</p>
          <p className="text-xs text-slate-500 mt-1">total attempts</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{progress.moduleProgress.length}</p>
          <p className="text-xs text-slate-500 mt-1">modules studied</p>
        </div>
      </div>

      {/* Weak areas */}
      {progress.weakAreas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Needs attention</h2>
          <div className="space-y-3">
            {progress.weakAreas.map((w) => (
              <div key={w.moduleId} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-medium text-amber-900">{w.moduleName}</p>
                <p className="text-xs text-amber-700 mt-0.5">{w.reasons.join(" · ")}</p>
                <p className="text-sm text-amber-800 mt-2 italic">{w.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">All modules</h2>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {progress.moduleProgress
            .sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt))
            .map((m) => (
              <div key={m.moduleId} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{m.moduleName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {m.totalAttempts} attempt{m.totalAttempts !== 1 ? "s" : ""} · {m.hintsPerQuestion.toFixed(1)} hints/q
                  </p>
                </div>
                <ScoreBar score={m.averageScore} />
                {(m.weakAreaFlags.lowAccuracy || m.weakAreaFlags.hintDependent || m.weakAreaFlags.errorProne) && (
                  <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Weak
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify the page compiles**

```bash
pnpm --filter web build 2>&1 | tail -5
```
Expected: exits 0 (or just type errors from unimplemented routes — those are OK at this stage as we haven't run `pnpm build` in trpc yet).

---

## Task 9: History detail drill-down

The existing history page is a flat list with no click-through. Replace it with a version that opens a detail panel on row click using the enriched `getAttemptDetail` endpoint.

**Files:**
- Replace: `apps/web/app/(dashboard)/history/page.tsx`

`apps/web/app/(dashboard)/history/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useListAttempts, useGetAttemptDetail } from "~/hooks/api/history";
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

function ScoreBadge({ awarded, max }: { awarded: number; max: number }) {
  const pct = max > 0 ? awarded / max : 0;
  const colour =
    pct === 1
      ? "text-emerald-600 bg-emerald-50"
      : pct >= 0.5
        ? "text-amber-600 bg-amber-50"
        : "text-rose-600 bg-rose-50";
  return (
    <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-sm ${colour}`}>
      <span className="text-lg leading-none">{awarded}</span>
      <span className="text-xs opacity-70">/{max}</span>
    </div>
  );
}

function DetailPanel({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { attempt, isLoading } = useGetAttemptDetail(attemptId);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Attempt detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
          </div>
        ) : !attempt ? (
          <p className="text-slate-400">Not found</p>
        ) : (
          <>
            {/* Score */}
            <div className="flex items-center gap-4">
              <ScoreBadge awarded={attempt.assessment.awardedMarks} max={attempt.assessment.maxMarks} />
              <div>
                <p className="font-semibold text-slate-800">
                  {attempt.assessment.awardedMarks} / {attempt.assessment.maxMarks} marks
                </p>
                <p className="text-xs text-slate-400">{formatDate(attempt.createdAt)} · {formatTime(attempt.timeSpentSeconds)} · {attempt.hintsUsedCount} hint{attempt.hintsUsedCount !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Question */}
            {attempt.questionText && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Question</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{attempt.questionText}</p>
              </div>
            )}

            {/* Your answer */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Your answer</p>
              {attempt.submissionType === "code" ? (
                <pre className="text-xs bg-slate-900 text-emerald-300 rounded-xl p-4 overflow-x-auto leading-relaxed">{attempt.submittedAnswer}</pre>
              ) : (
                <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 rounded-xl p-3">{attempt.submittedAnswer}</p>
              )}
            </div>

            {/* AI feedback */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Feedback</p>
              <p className="text-sm text-slate-700 leading-relaxed">{attempt.assessment.feedback}</p>
              {attempt.assessment.strengths.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attempt.assessment.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-emerald-700 flex gap-1.5"><span>✓</span>{s}</li>
                  ))}
                </ul>
              )}
              {attempt.assessment.missingPoints.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attempt.assessment.missingPoints.map((p, i) => (
                    <li key={i} className="text-xs text-rose-700 flex gap-1.5"><span>✗</span>{p}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Model answer */}
            {attempt.modelAnswer && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Model answer</p>
                {attempt.submissionType === "code" ? (
                  <pre className="text-xs bg-slate-900 text-indigo-300 rounded-xl p-4 overflow-x-auto leading-relaxed">{attempt.modelAnswer}</pre>
                ) : (
                  <p className="text-sm text-slate-800 leading-relaxed bg-indigo-50 rounded-xl p-3">{attempt.modelAnswer}</p>
                )}
              </div>
            )}

            {/* Mark scheme */}
            {attempt.markSchemePoints && attempt.markSchemePoints.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Mark scheme</p>
                <ul className="space-y-1">
                  {attempt.markSchemePoints.map((pt, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-slate-400">•</span>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { attempts, isLoading } = useListAttempts({ limit: 20 });
  const { modules } = useListModules();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const moduleMap = Object.fromEntries(modules.map((m) => [m.id, m]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">History</h1>
        <p className="text-slate-500 mt-1">Your past question attempts</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl" />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No attempts yet</p>
          <p className="text-sm mt-1">Start practising to see your history here</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800">
            Go to dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const mod = moduleMap[attempt.moduleId];
            return (
              <button
                key={attempt.id}
                onClick={() => setSelectedId(attempt.id)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <ScoreBadge awarded={attempt.awardedMarks} max={attempt.maxMarks} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{mod?.moduleName ?? "Module"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mod?.topicName ?? ""}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400">{formatDate(attempt.createdAt)}</span>
                    {attempt.hintsUsedCount > 0 && (
                      <span className="text-xs text-amber-500">{attempt.hintsUsedCount} hint{attempt.hintsUsedCount > 1 ? "s" : ""}</span>
                    )}
                    <span className="text-xs text-slate-400">{formatTime(attempt.timeSpentSeconds)}</span>
                  </div>
                </div>
                {attempt.attemptNumber > 1 && (
                  <span className="text-xs text-slate-400 flex-shrink-0">Attempt #{attempt.attemptNumber}</span>
                )}
                <span className="text-slate-300 flex-shrink-0">›</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedId && (
        <DetailPanel attemptId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
```

---

## Task 10: Dashboard stats widget

Add a quick stats bar to the student dashboard linking to the progress page.

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

**Step 1: Add import at top of file**

```typescript
import { useGetProgress } from "~/hooks/api/progress";
import Link from "next/link";
```

**Step 2: Add hook inside `DashboardPage` component**

Inside `DashboardPage`, before the return statement, add:
```typescript
const { progress } = useGetProgress();
```
Note: this hook is student-only — guard it so parents don't see it. The parent branch already returns `<ParentDashboard />` early, so `useGetProgress()` must be called before the parent check. Keep it unconditional (TanStack Query handles null gracefully).

**Step 3: Add the stats bar to the student view, just below the exam board badge**

After:
```tsx
{user?.examBoardPreference && (
  <span ...>{user.examBoardPreference}</span>
)}
```
Add:
```tsx
{progress && user?.role === "student" && (
  <Link
    href="/progress"
    className="mt-4 flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 transition-colors max-w-xs"
  >
    <div className="text-center">
      <p className="text-xl font-bold text-indigo-600">{progress.streak.currentDays}</p>
      <p className="text-xs text-slate-400">day streak</p>
    </div>
    <div className="w-px h-8 bg-slate-200" />
    <div className="text-center">
      <p className="text-xl font-bold text-slate-800">{progress.totalAttempts}</p>
      <p className="text-xs text-slate-400">total attempts</p>
    </div>
    <div className="ml-auto text-slate-300">›</div>
  </Link>
)}
```

**Step 4: Final build check**

```bash
pnpm --filter @gcse/trpc build && pnpm --filter @gcse/services build
```
Expected: both exit 0.

Run all tests:
```bash
pnpm --filter @gcse/services test
```
Expected: all tests pass (27 existing + new progress-service tests).

---

## Smoke Test Checklist

After `docker compose up --build`:

1. Log in as a student, answer a theory question → check `/progress` shows the module
2. Answer correctly (full marks) → check that re-generating a question from the same module skips the answered one
3. After 7 days (or temporarily set `nextReviewAt` to past in DB) → question reappears
4. `/history` → rows are clickable → detail panel shows question, answer, model answer, feedback
5. Answer a question with code errors repeatedly → check progress page flags module as "Weak"
6. Log in on two consecutive days → streak counter increments
7. Skip a day → streak resets to 1
8. Dashboard shows streak widget → clicking navigates to `/progress`
