# Phase 4 — Progress & Review Design

**Date:** 2026-03-07
**Status:** Approved

---

## Goal

Give students visibility into their learning progress: a progress page with per-module scores, streak, and AI-derived weak area recommendations; a full browseable attempt history with drill-down detail; and spaced repetition so correctly-answered questions return after a 7-day cooldown.

---

## Architecture Decision

**Hybrid materialized + on-the-fly.**

- A `student_progress` collection holds the pre-aggregated summary (module scores, streak, weak areas). Updated on every `submitAnswer` — cheap `findOneAndUpdate`.
- History list and attempt detail are plain paginated queries against `question_attempts` — no aggregation needed.
- Spaced repetition lives on `generated_questions` via a `nextReviewAt` field — no extra collection, no scheduler.

---

## Data Model

### New collection: `student_progress`

One document per student. Unique index on `userId`.

```typescript
{
  _id: ObjectId
  userId: ObjectId
  streak: {
    currentDays: number
    lastActivityDate: Date    // streak resets if gap > 1 day
  }
  moduleProgress: [{
    moduleId: ObjectId
    moduleName: string
    totalAttempts: number
    averageScore: number      // 0-100 percentage
    lastAttemptAt: Date
    hintsPerQuestion: number  // rolling average hints used per question
    weakAreaFlags: {
      hintDependent: boolean  // hintsPerQuestion > 2
      lowAccuracy: boolean    // averageScore < 50
      errorProne: boolean     // >30% of coding attempts had syntax/runtime errors
    }
  }]
  weakAreas: [{
    moduleId: ObjectId
    moduleName: string
    reasons: string[]         // e.g. ["Low accuracy (42%)", "Heavy hint use"]
    suggestedAction: string   // e.g. "Revisit loops — try easy difficulty first"
  }]
  totalAttempts: number
  updatedAt: Date
}
```

### Change to `generated_questions`

Add one optional field:

```typescript
nextReviewAt?: Date   // set to now + 7 days on a fully-correct answer
```

**Spaced repetition logic in `generateQuestion`:**
- Skip questions where `nextReviewAt > now` (correctly answered, in cooldown)
- Questions where `nextReviewAt <= now` become available again
- Questions with no correct attempt: `nextReviewAt` is null — always retryable

---

## tRPC Procedures

### New router: `progress`

| Procedure | Type | Input | Output |
|---|---|---|---|
| `getSummary` | query | `{ userId }` | Full `student_progress` doc: streak, moduleProgress[], weakAreas[], totalAttempts |
| `getModuleProgress` | query | `{ userId, moduleId }` | Single module entry from moduleProgress[] |

### New router: `history`

| Procedure | Type | Input | Output |
|---|---|---|---|
| `listAttempts` | query | `{ moduleId?, startDate?, endDate?, limit, continuationToken }` | Paginated: attemptId, date, moduleName, awardedMarks, maxMarks, hintsUsedCount, timeSpentSeconds, submissionType |
| `getAttemptDetail` | query | `{ attemptId }` | Full detail: questionText, submittedAnswer, modelAnswer, markSchemePoints, assessment (feedback, strengths, missingPoints, marks), hintsUsedCount, timeSpentSeconds, codingAnalysis? |

### Modified: `submitAnswer`

After saving `QuestionAttempt`, also:
1. Upsert `student_progress` document — update module entry (recalculate averageScore, hintsPerQuestion, weakAreaFlags), recompute weakAreas[], update streak
2. If `awardedMarks === maxMarks`, set `generated_question.nextReviewAt = now + 7 days`

**Streak update rules:**
- `lastActivityDate` is yesterday → `currentDays + 1`, update `lastActivityDate` to today
- `lastActivityDate` is today → no change (already counted)
- `lastActivityDate` is older → reset `currentDays` to 1, update `lastActivityDate` to today

**Weak area detection rules:**
- A module is flagged `hintDependent` if `hintsPerQuestion > 2`
- A module is flagged `lowAccuracy` if `averageScore < 50`
- A module is flagged `errorProne` if the student has submitted code attempts and >30% had `codingAnalysis.errorCategory` not null
- A module appears in `weakAreas[]` if it has any flag set AND at least 3 attempts
- `suggestedAction` is derived from the combination of flags (e.g. low accuracy alone → "Try easy difficulty first"; hint dependent → "Attempt without hints — use them only when stuck")

---

## Frontend

### New page: `/progress`

`apps/web/app/(dashboard)/progress/page.tsx`

```
┌─────────────────────────────────────────┐
│  5-day streak   |  47 total attempts    │
├─────────────────────────────────────────┤
│ Weak Areas                              │
│ ┌──────────────────────────────────┐   │
│ │ Loops & Iteration                │   │
│ │ Low accuracy (42%) · Heavy hints │   │
│ │ "Try easy difficulty first"      │   │
│ └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ All Modules                             │
│ Functions         ████████░░  78%  12  │
│ Loops             ████░░░░░░  42%   8  │
│ Data structures   ██████░░░░  61%   6  │
└─────────────────────────────────────────┘
```

### New page: `/history`

`apps/web/app/(dashboard)/history/page.tsx`

- Filterable list of attempts (by module dropdown, date range)
- Each row: date, module name, marks (e.g. "3 / 4"), time spent, hints used, submission type badge (Theory / Coding)
- Click row → detail panel (or page) showing full question, submitted answer, model answer, AI feedback, mark scheme points, marks awarded

### Dashboard widget

Add a small stats bar to `apps/web/app/(dashboard)/dashboard/page.tsx`:
- Streak badge (e.g. "5-day streak")
- "X attempts this week"
- Links to `/progress`

### Navigation

Add **Progress** and **History** links to the existing sidebar nav.

### New hooks: `apps/web/hooks/api/progress.tsx`

```typescript
useGetProgress(userId)         // query → { streak, moduleProgress, weakAreas, totalAttempts, isLoading }
useGetModuleProgress(userId, moduleId)  // query → { moduleProgress entry, isLoading }
```

### New hooks: `apps/web/hooks/api/history.tsx`

```typescript
useListAttempts(filters)       // query → { attempts[], hasMore, continuationToken, isLoading }
useGetAttemptDetail(attemptId) // query → { attempt detail, isLoading }
```

---

## File Changes

```
New:
  packages/database/models/student-progress.ts
  packages/services/src/progress-service/
    index.ts
    models.ts
  packages/trpc/src/server/routes/progress/
    route.ts
    models.ts
  packages/trpc/src/server/routes/history/
    route.ts
    models.ts
  apps/web/app/(dashboard)/progress/
    page.tsx
  apps/web/app/(dashboard)/history/
    page.tsx
  apps/web/hooks/api/progress.tsx
  apps/web/hooks/api/history.tsx

Modified:
  packages/database/models/generated-question.ts   ← add nextReviewAt field
  packages/database/index.ts                        ← export StudentProgress model + types
  packages/services/src/index.ts                    ← export ProgressService
  packages/trpc/src/server/index.ts                 ← register progress + history routers
  packages/trpc/src/server/context.ts               ← add progressSvc to context
  packages/trpc/src/server/routes/questions/route.ts ← submitAnswer: update progress + spaced repetition
  packages/services/src/question-generation-service/index.ts ← filter nextReviewAt in generateQuestion
  apps/web/app/(dashboard)/dashboard/page.tsx        ← add stats widget
  apps/web/app/(dashboard)/layout.tsx (or nav)       ← add Progress + History nav links
```

---

## Error Handling

| Case | Behaviour |
|---|---|
| Student has no attempts yet | Progress page shows empty state: "No attempts yet — start practising!" |
| Module not in weak areas | Module shown in grid with score only, no weak area card |
| History filtered with no results | Empty state: "No attempts match these filters" |
| `getAttemptDetail` for another student's attempt | tRPC `NOT_FOUND` (server scopes by userId) |
| Streak gap of exactly 1 day | Streak preserved (checked on `lastActivityDate` date, not time) |
