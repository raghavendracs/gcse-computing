# Theory/Coding Question Separation

**Date**: 2026-03-08
**Goal**: Enforce strict separation between theory and coding question generation so theory practice never asks students to write programs, and coding practice only involves writing programs.

## Question Type Classification

**Theory types** (answer format: `free_text`):
- `multiple_choice`, `short_answer`, `extended`, `trace_table`, `fill_gap`, `predict_output`

**Coding types** (answer format: `code`):
- `coding`, `fix_code`

Types like `trace_table`, `predict_output`, and `fill_gap` involve reading/tracing code but the student answers with text — these are conceptual analysis, not programming, so they belong in theory.

## Changes

### 1. Service layer — `GenerateQuestionInput` model
Add optional `mode: "theory" | "coding"` to the Zod input schema in `packages/services/src/question-generation-service/models.ts`.

### 2. Service layer — `QuestionGenerationService.generateQuestion()`
- Accept `mode` from input
- **Template query**: filter `QuestionTemplate` by `questionType` matching the mode's allowed types
- **Cache query**: filter cached `GeneratedQuestion` by `answerFormat` (`"free_text"` for theory, `"code"` for coding)
- **Fallback default**: if no template found, default to `"short_answer"` for theory, `"coding"` for coding (currently always defaults to `"short_answer"`)
- **isCoding flag**: derive from mode when available, fall back to template-based detection

### 3. AI system prompts
- **Theory prompt**: add rule — "Do NOT ask the student to write any programs or code. Questions must test conceptual understanding, recall, and analysis only."
- **Coding prompt**: add rule — "The question MUST require writing a Python program."

### 4. tRPC route — `generateQuestion` procedure
Add optional `mode` field to the input schema in `packages/trpc/src/server/routes/questions/models.ts` and forward it to the service.

### 5. Frontend pages
- **Practice page** (`modules/[id]/practice/page.tsx`): pass `mode: "theory"` to `generateQuestion.mutateAsync()`
- **Coding page** (`modules/[id]/coding/page.tsx`): pass `mode: "coding"` to `generateQuestion.mutateAsync()`

### 6. No DB schema changes
Existing `questionType` and `answerFormat` fields already capture this distinction.
