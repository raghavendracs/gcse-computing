# Phase 1 — Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the full pnpm monorepo, wire up auth (parent + student), seed the MongoDB curriculum, and render a working dashboard.

**Architecture:** pnpm monorepo with `apps/web` (Next.js App Router) and `apps/api` (Express + tRPC), sharing types via `packages/database` and `packages/trpc`. JWT auth via HTTP-only cookie. MongoDB via Mongoose.

**Tech Stack:** Node.js 20, pnpm 9, TypeScript 5, Next.js 15 (App Router), Express 4, tRPC v11, Mongoose 8, Tailwind CSS, shadcn/ui, Vitest, bcryptjs, jsonwebtoken

---

## Task 1: Initialize monorepo skeleton

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `apps/web/.gitkeep`
- Create: `apps/api/.gitkeep`
- Create: `packages/database/.gitkeep`
- Create: `packages/services/.gitkeep`
- Create: `packages/trpc/.gitkeep`

**Step 1: Create root workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 2: Create root package.json**

```json
{
  "name": "gcse-coding",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter './apps/*' dev",
    "build": "pnpm --filter './packages/*' build && pnpm --filter './apps/*' build",
    "lint": "pnpm --recursive lint",
    "type-check": "pnpm --recursive type-check",
    "test": "pnpm --recursive test"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Create shared tsconfig**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 4: Create directory structure**

```bash
mkdir -p apps/web apps/api packages/database/src/models packages/services/src packages/trpc/src/server/routes
```

**Step 5: Install root devDependencies**

```bash
cd /Users/raghucs/2026-Projects/gsce-coding && pnpm install
```

---

## Task 2: Set up packages/database

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/models/_base.model.ts`
- Create: `packages/database/src/models/user.ts`
- Create: `packages/database/src/models/module.ts`
- Create: `packages/database/src/models/question-template.ts`
- Create: `packages/database/src/models/generated-question.ts`
- Create: `packages/database/src/models/question-attempt.ts`
- Create: `packages/database/src/models/hint-event.ts`
- Create: `packages/database/src/models/study-session.ts`
- Create: `packages/database/src/connection.ts`
- Create: `packages/database/src/index.ts`

**Step 1: package.json**

```json
{
  "name": "@gcse/database",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "mongoose": "^8.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

**Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Base model interface**

```typescript
// src/models/_base.model.ts
import { Types } from "mongoose";

export interface BaseMongodbSchema {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

**Step 4: User model**

```typescript
// src/models/user.ts
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IUser extends BaseMongodbSchema {
  email: string;
  passwordHash: string;
  fullName: string;
  role: "parent" | "student";
  parentId?: Types.ObjectId;
  examBoardPreference?: "OCR" | "AQA" | "Edexcel";
  aiModelPreference?: "accurate" | "balanced" | "budget";
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ["parent", "student"], required: true },
    parentId: { type: Schema.ObjectId, ref: "users", required: false },
    examBoardPreference: {
      type: String,
      enum: ["OCR", "AQA", "Edexcel"],
      required: false,
    },
    aiModelPreference: {
      type: String,
      enum: ["accurate", "balanced", "budget"],
      default: "balanced",
      required: false,
    },
    lastLoginAt: { type: Date, required: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 });
userSchema.index({ parentId: 1 });
userSchema.index({ role: 1 });

export const User = model<IUser>("users", userSchema);
export default User;
```

**Step 5: Module model**

```typescript
// src/models/module.ts
import { Schema, model } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IModule extends BaseMongodbSchema {
  examBoard: "OCR" | "AQA" | "Edexcel" | "generic";
  moduleCode: string;
  moduleName: string;
  topicName: string;
  topicType: "theory" | "programming" | "mixed";
  description: string;
  specReferences: string[];
  difficultyBands: ("easy" | "medium" | "hard")[];
  sortOrder: number;
}

const moduleSchema = new Schema<IModule>(
  {
    examBoard: {
      type: String,
      enum: ["OCR", "AQA", "Edexcel", "generic"],
      required: true,
    },
    moduleCode: { type: String, required: true },
    moduleName: { type: String, required: true },
    topicName: { type: String, required: true },
    topicType: {
      type: String,
      enum: ["theory", "programming", "mixed"],
      required: true,
    },
    description: { type: String, required: true },
    specReferences: [{ type: String }],
    difficultyBands: [{ type: String, enum: ["easy", "medium", "hard"] }],
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

moduleSchema.index({ examBoard: 1 });
moduleSchema.index({ moduleCode: 1 });
moduleSchema.index({ topicType: 1 });
moduleSchema.index({ sortOrder: 1 });

export const Module = model<IModule>("modules", moduleSchema);
export default Module;
```

**Step 6: QuestionTemplate model**

```typescript
// src/models/question-template.ts
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IQuestionTemplate extends BaseMongodbSchema {
  moduleId: Types.ObjectId;
  questionType:
    | "multiple_choice"
    | "short_answer"
    | "extended"
    | "coding"
    | "trace_table"
    | "fill_gap"
    | "predict_output"
    | "fix_code";
  templateName: string;
  promptTemplate: string;
  generationRules: {
    parameters: string[];
    difficulty: "easy" | "medium" | "hard";
  };
  rubric: {
    maxMarks: number;
    markSchemePoints: string[];
    acceptedConcepts: string[];
    commonMisconceptions: string[];
  };
  hintFramework: string[];
  modelAnswerTemplate: string;
  active: boolean;
}

const questionTemplateSchema = new Schema<IQuestionTemplate>(
  {
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    questionType: {
      type: String,
      enum: [
        "multiple_choice",
        "short_answer",
        "extended",
        "coding",
        "trace_table",
        "fill_gap",
        "predict_output",
        "fix_code",
      ],
      required: true,
    },
    templateName: { type: String, required: true },
    promptTemplate: { type: String, required: true },
    generationRules: {
      parameters: [{ type: String }],
      difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    },
    rubric: {
      maxMarks: { type: Number, required: true },
      markSchemePoints: [{ type: String }],
      acceptedConcepts: [{ type: String }],
      commonMisconceptions: [{ type: String }],
    },
    hintFramework: [{ type: String }],
    modelAnswerTemplate: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

questionTemplateSchema.index({ moduleId: 1 });
questionTemplateSchema.index({ questionType: 1 });
questionTemplateSchema.index({ active: 1 });

export const QuestionTemplate = model<IQuestionTemplate>(
  "question_templates",
  questionTemplateSchema,
);
export default QuestionTemplate;
```

**Step 7: GeneratedQuestion model**

```typescript
// src/models/generated-question.ts
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface ITestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface IGeneratedQuestion extends BaseMongodbSchema {
  moduleId: Types.ObjectId;
  templateId?: Types.ObjectId;
  userId: Types.ObjectId;
  questionType: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  answerFormat: "free_text" | "code" | "multiple_choice";
  maxMarks: number;
  markSchemePoints: string[];
  modelAnswer: string;
  hints: string[];
  testCases: ITestCase[];
  metadata: {
    examBoard: string;
    topicName: string;
    misconceptionNotes: string[];
  };
  usedInSession: boolean;
}

const generatedQuestionSchema = new Schema<IGeneratedQuestion>(
  {
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    templateId: { type: Schema.ObjectId, required: false, ref: "question_templates" },
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionType: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    questionText: { type: String, required: true },
    answerFormat: {
      type: String,
      enum: ["free_text", "code", "multiple_choice"],
      required: true,
    },
    maxMarks: { type: Number, required: true },
    markSchemePoints: [{ type: String }],
    modelAnswer: { type: String, required: true },
    hints: [{ type: String }],
    testCases: [
      {
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        hidden: { type: Boolean, default: false },
      },
    ],
    metadata: {
      examBoard: { type: String, required: true },
      topicName: { type: String, required: true },
      misconceptionNotes: [{ type: String }],
    },
    usedInSession: { type: Boolean, default: false },
  },
  { timestamps: true },
);

generatedQuestionSchema.index({ userId: 1, moduleId: 1 });
generatedQuestionSchema.index({ userId: 1, usedInSession: 1 });
generatedQuestionSchema.index({ createdAt: -1 });

export const GeneratedQuestion = model<IGeneratedQuestion>(
  "generated_questions",
  generatedQuestionSchema,
);
export default GeneratedQuestion;
```

**Step 8: QuestionAttempt model**

```typescript
// src/models/question-attempt.ts
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IQuestionAttempt extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  moduleId: Types.ObjectId;
  attemptNumber: number;
  submittedAnswer: string;
  submissionType: "text" | "code";
  assessment: {
    awardedMarks: number;
    maxMarks: number;
    feedback: string;
    missingPoints: string[];
    strengths: string[];
    confidence: number;
  };
  codingAnalysis?: {
    syntaxValid: boolean;
    testsPassed: number;
    testsFailed: number;
    errorCategory: "syntax" | "logic" | "runtime" | null;
    executionPath: "sandbox" | "ai";
  };
  hintsUsedCount: number;
  timeSpentSeconds: number;
}

const questionAttemptSchema = new Schema<IQuestionAttempt>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "generated_questions" },
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    attemptNumber: { type: Number, required: true, default: 1 },
    submittedAnswer: { type: String, required: true },
    submissionType: { type: String, enum: ["text", "code"], required: true },
    assessment: {
      awardedMarks: { type: Number, required: true },
      maxMarks: { type: Number, required: true },
      feedback: { type: String, required: true },
      missingPoints: [{ type: String }],
      strengths: [{ type: String }],
      confidence: { type: Number, required: true },
    },
    codingAnalysis: {
      syntaxValid: { type: Boolean },
      testsPassed: { type: Number },
      testsFailed: { type: Number },
      errorCategory: { type: String, enum: ["syntax", "logic", "runtime", null] },
      executionPath: { type: String, enum: ["sandbox", "ai"] },
    },
    hintsUsedCount: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
  },
  { timestamps: true },
);

questionAttemptSchema.index({ userId: 1, moduleId: 1 });
questionAttemptSchema.index({ userId: 1, questionId: 1 });
questionAttemptSchema.index({ createdAt: -1 });

export const QuestionAttempt = model<IQuestionAttempt>(
  "question_attempts",
  questionAttemptSchema,
);
export default QuestionAttempt;
```

**Step 9: HintEvent model**

```typescript
// src/models/hint-event.ts
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IHintEvent extends BaseMongodbSchema {
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  moduleId: Types.ObjectId;
  hintLevel: 1 | 2 | 3 | 4 | 5;
  hintText: string;
  requestedAt: Date;
}

const hintEventSchema = new Schema<IHintEvent>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    questionId: { type: Schema.ObjectId, required: true, ref: "generated_questions" },
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    hintLevel: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    hintText: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

hintEventSchema.index({ userId: 1, questionId: 1 });
hintEventSchema.index({ userId: 1, moduleId: 1 });

export const HintEvent = model<IHintEvent>("hint_events", hintEventSchema);
export default HintEvent;
```

**Step 10: StudySession model**

```typescript
// src/models/study-session.ts
import { Schema, model, Types } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface IStudySession extends BaseMongodbSchema {
  userId: Types.ObjectId;
  moduleId: Types.ObjectId;
  mode: "theory" | "coding" | "mixed" | "timed" | "review";
  startedAt: Date;
  endedAt?: Date;
  questionIds: Types.ObjectId[];
  summary: {
    questionsAttempted: number;
    averageScore: number;
    hintsUsed: number;
  };
}

const studySessionSchema = new Schema<IStudySession>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users" },
    moduleId: { type: Schema.ObjectId, required: true, ref: "modules" },
    mode: {
      type: String,
      enum: ["theory", "coding", "mixed", "timed", "review"],
      required: true,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, required: false },
    questionIds: [{ type: Schema.ObjectId, ref: "generated_questions" }],
    summary: {
      questionsAttempted: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      hintsUsed: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

studySessionSchema.index({ userId: 1 });
studySessionSchema.index({ userId: 1, moduleId: 1 });
studySessionSchema.index({ startedAt: -1 });

export const StudySession = model<IStudySession>("study_sessions", studySessionSchema);
export default StudySession;
```

**Step 11: Database connection utility**

```typescript
// src/connection.ts
import mongoose from "mongoose";

let isConnected = false;

export async function connectToDatabase(uri: string): Promise<void> {
  if (isConnected) return;
  await mongoose.connect(uri);
  isConnected = true;
  console.log("Connected to MongoDB");
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}
```

**Step 12: Database index.ts barrel**

```typescript
// src/index.ts
export { connectToDatabase, disconnectFromDatabase } from "./connection";

// Models
export { User } from "./models/user";
export { Module } from "./models/module";
export { QuestionTemplate } from "./models/question-template";
export { GeneratedQuestion } from "./models/generated-question";
export { QuestionAttempt } from "./models/question-attempt";
export { HintEvent } from "./models/hint-event";
export { StudySession } from "./models/study-session";

// Types
export type { IUser } from "./models/user";
export type { IModule } from "./models/module";
export type { IQuestionTemplate } from "./models/question-template";
export type { IGeneratedQuestion, ITestCase } from "./models/generated-question";
export type { IQuestionAttempt } from "./models/question-attempt";
export type { IHintEvent } from "./models/hint-event";
export type { IStudySession } from "./models/study-session";
```

**Step 13: Install and build**

```bash
cd packages/database && pnpm install && pnpm build
```

Expected: `dist/` folder created with `.js` and `.d.ts` files.

---

## Task 3: Set up packages/trpc

**Files:**
- Create: `packages/trpc/package.json`
- Create: `packages/trpc/tsconfig.json`
- Create: `packages/trpc/src/server/trpc.ts`
- Create: `packages/trpc/src/server/context.ts`
- Create: `packages/trpc/src/server/index.ts`
- Create: `packages/trpc/src/client/index.ts`

**Step 1: package.json**

```json
{
  "name": "@gcse/trpc",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./server": {
      "types": "./dist/server/index.d.ts",
      "default": "./dist/server/index.js"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "default": "./dist/client/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0",
    "@gcse/database": "workspace:*",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: tRPC base setup with context**

```typescript
// src/server/context.ts
import { inferAsyncReturnType } from "@trpc/server";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface JWTPayload {
  userId: string;
  role: "parent" | "student";
  parentId?: string;
}

export interface TRPCContext {
  req: Request;
  res: Response;
  user: JWTPayload | null;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TRPCContext> {
  const token = req.cookies?.gcse_token;
  let user: JWTPayload | null = null;

  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch {
      // Invalid token — user stays null
    }
  }

  return { req, res, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;
```

**Step 4: tRPC instance + procedures**

```typescript
// src/server/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { Context } from "./context";
import { ZodError } from "zod";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const parentOnlyProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "parent") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Parent access required" });
  }
  return next({ ctx });
});

export const studentProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "student") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Student access required" });
  }
  return next({ ctx });
});
```

**Step 5: Root server index (stub routers for now)**

```typescript
// src/server/index.ts
import { router } from "./trpc";
import { authRouter } from "./routes/auth/route";
import { modulesRouter } from "./routes/modules/route";

export const appRouter = router({
  auth: authRouter,
  modules: modulesRouter,
  // questions, sessions, history, progress — added in later phases
});

export type AppRouter = typeof appRouter;
```

**Step 6: Client-side tRPC type export**

```typescript
// src/client/index.ts
export type { AppRouter } from "../server/index";
```

---

## Task 4: Auth service in packages/services

**Files:**
- Create: `packages/services/package.json`
- Create: `packages/services/tsconfig.json`
- Create: `packages/services/src/auth-service/index.ts`
- Create: `packages/services/src/auth-service/models.ts`
- Create: `packages/services/src/index.ts`
- Test: `packages/services/src/auth-service/__tests__/auth-service.test.ts`

**Step 1: package.json**

```json
{
  "name": "@gcse/services",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@gcse/database": "workspace:*",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: Auth service Zod models**

```typescript
// src/auth-service/models.ts
import { z } from "zod";

export const signupParentPayload = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).default("balanced"),
});
export type SignupParentPayload = z.infer<typeof signupParentPayload>;

export const signupStudentPayload = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  parentId: z.string(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).default("OCR"),
});
export type SignupStudentPayload = z.infer<typeof signupStudentPayload>;

export const loginPayload = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginPayload = z.infer<typeof loginPayload>;

export const updateProfilePayload = z.object({
  fullName: z.string().min(1).optional(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).optional(),
});
export type UpdateProfilePayload = z.infer<typeof updateProfilePayload>;
```

**Step 3: Write failing tests first**

```typescript
// src/auth-service/__tests__/auth-service.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import AuthService from "../index";

// Mock mongoose User model
vi.mock("@gcse/database", () => ({
  User: {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

const authService = new AuthService("test-jwt-secret");

describe("AuthService", () => {
  describe("hashPassword", () => {
    it("hashes a password and verifies it", async () => {
      const hash = await authService.hashPassword("mypassword123");
      expect(hash).not.toBe("mypassword123");
      const valid = await authService.verifyPassword("mypassword123", hash);
      expect(valid).toBe(true);
    });

    it("returns false for wrong password", async () => {
      const hash = await authService.hashPassword("mypassword123");
      const valid = await authService.verifyPassword("wrongpassword", hash);
      expect(valid).toBe(false);
    });
  });

  describe("generateToken / verifyToken", () => {
    it("generates a JWT and verifies it", () => {
      const payload = { userId: "abc123", role: "student" as const };
      const token = authService.generateToken(payload);
      expect(typeof token).toBe("string");
      const decoded = authService.verifyToken(token);
      expect(decoded?.userId).toBe("abc123");
      expect(decoded?.role).toBe("student");
    });

    it("returns null for invalid token", () => {
      const result = authService.verifyToken("not-a-valid-token");
      expect(result).toBeNull();
    });
  });
});
```

**Step 4: Run test to verify it fails**

```bash
cd packages/services && pnpm test
```

Expected: FAIL — `AuthService` not found.

**Step 5: Implement AuthService**

```typescript
// src/auth-service/index.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "@gcse/database";
import { Types } from "mongoose";
import {
  LoginPayload,
  SignupParentPayload,
  SignupStudentPayload,
  UpdateProfilePayload,
  loginPayload,
  signupParentPayload,
  signupStudentPayload,
  updateProfilePayload,
} from "./models";

interface JWTPayload {
  userId: string;
  role: "parent" | "student";
  parentId?: string;
}

class AuthService {
  constructor(private readonly jwtSecret: string) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: "7d" });
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch {
      return null;
    }
  }

  async signupParent(input: SignupParentPayload) {
    const data = await signupParentPayload.parseAsync(input);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await this.hashPassword(data.password);
    const user = await User.insertOne({
      email: data.email.toLowerCase(),
      passwordHash,
      fullName: data.fullName.trim(),
      role: "parent",
      aiModelPreference: data.aiModelPreference,
    });

    return this.toPublicUser(user);
  }

  async createStudent(input: SignupStudentPayload) {
    const data = await signupStudentPayload.parseAsync(input);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await this.hashPassword(data.password);
    const user = await User.insertOne({
      email: data.email.toLowerCase(),
      passwordHash,
      fullName: data.fullName.trim(),
      role: "student",
      parentId: new Types.ObjectId(data.parentId),
      examBoardPreference: data.examBoardPreference,
    });

    return this.toPublicUser(user);
  }

  async login(input: LoginPayload) {
    const data = await loginPayload.parseAsync(input);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) throw new Error("Invalid email or password");

    const valid = await this.verifyPassword(data.password, user.passwordHash);
    if (!valid) throw new Error("Invalid email or password");

    await User.findOneAndUpdate(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const token = this.generateToken({
      userId: user._id.toString(),
      role: user.role,
      parentId: user.parentId?.toString(),
    });

    return { token, user: this.toPublicUser(user) };
  }

  async getUserById(id: string) {
    const user = await User.findOne({ _id: new Types.ObjectId(id) });
    if (!user) throw new Error("User not found");
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfilePayload) {
    const data = await updateProfilePayload.parseAsync(input);
    const updateFields: Record<string, unknown> = {};
    if (data.fullName) updateFields.fullName = data.fullName.trim();
    if (data.examBoardPreference) updateFields.examBoardPreference = data.examBoardPreference;
    if (data.aiModelPreference) updateFields.aiModelPreference = data.aiModelPreference;

    if (Object.keys(updateFields).length === 0) throw new Error("No fields to update");

    const user = await User.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { $set: updateFields },
      { new: true },
    );
    if (!user) throw new Error("User not found");
    return this.toPublicUser(user);
  }

  async getStudentsForParent(parentId: string) {
    const students = await User.find({
      $and: [{ parentId: new Types.ObjectId(parentId) }, { role: "student" }],
    });
    return students.map(this.toPublicUser);
  }

  private toPublicUser(user: any) {
    return {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role as "parent" | "student",
      parentId: user.parentId?.toString(),
      examBoardPreference: user.examBoardPreference,
      aiModelPreference: user.aiModelPreference,
      createdAt: user.createdAt?.toString(),
      updatedAt: user.updatedAt?.toString(),
    };
  }
}

export default AuthService;
```

**Step 6: Run tests to verify they pass**

```bash
cd packages/services && pnpm test
```

Expected: All tests PASS.

---

## Task 5: tRPC auth + modules routers

**Files:**
- Create: `packages/trpc/src/server/routes/auth/models.ts`
- Create: `packages/trpc/src/server/routes/auth/route.ts`
- Create: `packages/trpc/src/server/routes/modules/models.ts`
- Create: `packages/trpc/src/server/routes/modules/route.ts`

**Step 1: Auth route models**

```typescript
// src/server/routes/auth/models.ts
import { z } from "zod";

export const signupInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).default("balanced"),
});

export const loginInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createStudentInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).default("OCR"),
});

export const updateProfileInputModel = z.object({
  fullName: z.string().min(1).optional(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).optional(),
});

export const publicUserModel = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(["parent", "student"]),
  parentId: z.string().optional(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
```

**Step 2: Auth route**

```typescript
// src/server/routes/auth/route.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  authenticatedProcedure,
  parentOnlyProcedure,
  publicProcedure,
  router,
} from "../../trpc";
import {
  signupInputModel,
  loginInputModel,
  createStudentInputModel,
  updateProfileInputModel,
  publicUserModel,
} from "./models";
import AuthService from "@gcse/services/auth-service";

const authService = new AuthService(process.env.JWT_SECRET!);

export const authRouter = router({
  signup: publicProcedure
    .input(signupInputModel)
    .output(publicUserModel)
    .mutation(async ({ input }) => {
      return authService.signupParent(input);
    }),

  login: publicProcedure
    .input(loginInputModel)
    .output(z.object({ user: publicUserModel }))
    .mutation(async ({ ctx, input }) => {
      const { token, user } = await authService.login(input);
      ctx.res.cookie("gcse_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      return { user };
    }),

  logout: authenticatedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      ctx.res.clearCookie("gcse_token");
      return { success: true };
    }),

  me: authenticatedProcedure
    .output(publicUserModel)
    .query(async ({ ctx }) => {
      return authService.getUserById(ctx.user.userId);
    }),

  createStudent: parentOnlyProcedure
    .input(createStudentInputModel)
    .output(publicUserModel)
    .mutation(async ({ ctx, input }) => {
      return authService.createStudent({
        ...input,
        parentId: ctx.user.userId,
      });
    }),

  getStudents: parentOnlyProcedure
    .output(z.array(publicUserModel))
    .query(async ({ ctx }) => {
      return authService.getStudentsForParent(ctx.user.userId);
    }),

  updateProfile: authenticatedProcedure
    .input(updateProfileInputModel)
    .output(publicUserModel)
    .mutation(async ({ ctx, input }) => {
      return authService.updateProfile(ctx.user.userId, input);
    }),
});
```

**Step 3: Modules route models**

```typescript
// src/server/routes/modules/models.ts
import { z } from "zod";

export const moduleOutputModel = z.object({
  id: z.string(),
  examBoard: z.enum(["OCR", "AQA", "Edexcel", "generic"]),
  moduleCode: z.string(),
  moduleName: z.string(),
  topicName: z.string(),
  topicType: z.enum(["theory", "programming", "mixed"]),
  description: z.string(),
  specReferences: z.array(z.string()),
  difficultyBands: z.array(z.enum(["easy", "medium", "hard"])),
  sortOrder: z.number(),
});

export const listModulesInputModel = z.object({
  examBoard: z.enum(["OCR", "AQA", "Edexcel", "generic"]).optional(),
  topicType: z.enum(["theory", "programming", "mixed"]).optional(),
});
```

**Step 4: Modules route**

```typescript
// src/server/routes/modules/route.ts
import { Module } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import { listModulesInputModel, moduleOutputModel } from "./models";
import { z } from "zod";

export const modulesRouter = router({
  listModules: authenticatedProcedure
    .input(listModulesInputModel)
    .output(z.array(moduleOutputModel))
    .query(async ({ input }) => {
      const conditions: Record<string, unknown> = {};
      if (input.examBoard) conditions.examBoard = { $in: [input.examBoard, "generic"] };
      if (input.topicType) conditions.topicType = input.topicType;

      const modules = await Module.find(conditions).sort({ sortOrder: 1 });
      return modules.map((m) => ({
        id: m._id.toString(),
        examBoard: m.examBoard,
        moduleCode: m.moduleCode,
        moduleName: m.moduleName,
        topicName: m.topicName,
        topicType: m.topicType,
        description: m.description,
        specReferences: m.specReferences,
        difficultyBands: m.difficultyBands,
        sortOrder: m.sortOrder,
      }));
    }),

  getModuleById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .output(moduleOutputModel)
    .query(async ({ input }) => {
      const { Types } = await import("mongoose");
      const m = await Module.findOne({ _id: new Types.ObjectId(input.id) });
      if (!m) throw new Error("Module not found");
      return {
        id: m._id.toString(),
        examBoard: m.examBoard,
        moduleCode: m.moduleCode,
        moduleName: m.moduleName,
        topicName: m.topicName,
        topicType: m.topicType,
        description: m.description,
        specReferences: m.specReferences,
        difficultyBands: m.difficultyBands,
        sortOrder: m.sortOrder,
      };
    }),
});
```

---

## Task 6: Set up apps/api (Express + tRPC)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/seed/index.ts`
- Create: `apps/api/src/seed/modules.ts`
- Create: `apps/api/src/seed/templates.ts`

**Step 1: package.json**

```json
{
  "name": "@gcse/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed": "tsx src/seed/index.ts"
  },
  "dependencies": {
    "@gcse/database": "workspace:*",
    "@gcse/services": "workspace:*",
    "@gcse/trpc": "workspace:*",
    "@trpc/server": "^11.0.0",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "express": "^4.19.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "Node"
  },
  "include": ["src"]
}
```

**Step 3: Express app entry point**

```typescript
// src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as trpcExpress from "@trpc/server/adapters/express";
import { connectToDatabase } from "@gcse/database";
import { appRouter } from "@gcse/trpc/server";
import { createContext } from "@gcse/trpc/server/context";
import { runSeedIfEmpty } from "./seed/index";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.WEB_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function main() {
  await connectToDatabase(process.env.MONGODB_URI || "mongodb://localhost:27017/gcse");
  await runSeedIfEmpty();
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}

main().catch(console.error);
```

**Step 4: Seed modules data**

```typescript
// src/seed/modules.ts
export const seedModules = [
  {
    examBoard: "generic" as const,
    moduleCode: "ALGO-01",
    moduleName: "Algorithms",
    topicName: "Computational Thinking & Decomposition",
    topicType: "theory" as const,
    description: "Decomposition, abstraction, and algorithmic thinking fundamentals",
    specReferences: ["J277 2.1", "AQA 3.3.1"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 1,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "ALGO-02",
    moduleName: "Algorithms",
    topicName: "Searching and Sorting",
    topicType: "theory" as const,
    description: "Linear search, binary search, bubble sort, merge sort, insertion sort",
    specReferences: ["J277 2.1.1", "AQA 3.3.2"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 2,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "PROG-01",
    moduleName: "Programming Fundamentals",
    topicName: "Variables, Input/Output and Data Types",
    topicType: "programming" as const,
    description: "Variables, constants, data types, input/output in Python",
    specReferences: ["J277 2.2.1", "AQA 3.3.3"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 3,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "PROG-02",
    moduleName: "Programming Fundamentals",
    topicName: "Sequence, Selection and Iteration",
    topicType: "programming" as const,
    description: "if/elif/else, for loops, while loops, nested structures in Python",
    specReferences: ["J277 2.2.2", "AQA 3.3.3"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 4,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "PROG-03",
    moduleName: "Programming Fundamentals",
    topicName: "Functions and Subprograms",
    topicType: "programming" as const,
    description: "Defining and calling functions, parameters, return values, scope",
    specReferences: ["J277 2.2.3", "AQA 3.3.4"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 5,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "PROG-04",
    moduleName: "Programming Fundamentals",
    topicName: "Lists, Strings and File Handling",
    topicType: "programming" as const,
    description: "Lists, string methods, file read/write, defensive design",
    specReferences: ["J277 2.2.4", "AQA 3.3.5"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 6,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "DATA-01",
    moduleName: "Data Representation",
    topicName: "Binary, Units and Character Sets",
    topicType: "theory" as const,
    description: "Binary numbers, hexadecimal, units of data, ASCII and Unicode",
    specReferences: ["J277 1.4", "AQA 3.2.6"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 7,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "NET-01",
    moduleName: "Networks",
    topicName: "Network Types, Protocols and Security",
    topicType: "theory" as const,
    description: "LAN/WAN, topologies, TCP/IP, HTTP, cybersecurity basics",
    specReferences: ["J277 1.3", "AQA 3.2.4"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 8,
  },
  {
    examBoard: "generic" as const,
    moduleCode: "SYS-01",
    moduleName: "Computer Systems",
    topicName: "Hardware, CPU and Memory",
    topicType: "theory" as const,
    description: "CPU architecture, fetch-decode-execute, RAM/ROM, storage types",
    specReferences: ["J277 1.1", "AQA 3.2.1"],
    difficultyBands: ["easy", "medium", "hard"] as const[],
    sortOrder: 9,
  },
];
```

**Step 5: Seed templates data (excerpt — key templates per topic)**

```typescript
// src/seed/templates.ts — abbreviated, full version has 5+ per module
export const seedTemplates = [
  // PROG-01 theory template
  {
    moduleCode: "PROG-01",
    questionType: "short_answer" as const,
    templateName: "Variable vs constant distinction",
    promptTemplate:
      "Explain the difference between a variable and a constant in programming, giving one example of each.",
    generationRules: { parameters: [], difficulty: "easy" as const },
    rubric: {
      maxMarks: 4,
      markSchemePoints: [
        "A variable can change value during program execution",
        "A constant has a fixed value that cannot change",
        "Example of a variable (e.g. score, name, counter)",
        "Example of a constant (e.g. PI, MAX_SIZE, GRAVITY)",
      ],
      acceptedConcepts: ["variable", "constant", "value", "change", "fixed"],
      commonMisconceptions: ["Confusing constants with read-only variables", "Thinking variables must be numbers"],
    },
    hintFramework: [
      "Think about what 'variable' means in everyday language — something that can vary.",
      "A constant is the opposite — think of values in real life that never change, like the value of pi.",
      "Look at the keyword: 'variable' comes from 'vary', meaning to change.",
      "In Python, constants are usually written in UPPER_CASE by convention. What does that tell you?",
      "A variable is like a labelled box whose contents can be swapped. A constant is a box that is sealed shut.",
    ],
    modelAnswerTemplate:
      "A variable is a named storage location whose value can change during program execution (e.g. score = 0, then score = 10). A constant is a named value that remains fixed throughout (e.g. PI = 3.14159). Variables allow programs to track changing state; constants prevent accidental modification of fixed values.",
  },
  // PROG-02 coding template
  {
    moduleCode: "PROG-02",
    questionType: "coding" as const,
    templateName: "Loop accumulator challenge",
    promptTemplate:
      "Write a Python program that asks the user to enter 5 numbers one at a time and then prints the total of all numbers entered.",
    generationRules: { parameters: ["loopCount", "targetOperation"], difficulty: "medium" as const },
    rubric: {
      maxMarks: 6,
      markSchemePoints: [
        "Initialises a total/accumulator variable to 0 before the loop",
        "Uses a loop that runs exactly 5 times",
        "Uses input() inside the loop to collect each number",
        "Converts input to a number type (int() or float())",
        "Adds each number to the running total",
        "Prints the final total after the loop ends",
      ],
      acceptedConcepts: ["for loop", "while loop", "accumulator", "input", "int", "float"],
      commonMisconceptions: [
        "Forgetting to convert input() string to number",
        "Reinitialising total inside the loop",
        "Printing inside instead of after the loop",
      ],
    },
    hintFramework: [
      "Think about what information needs to be stored before the loop begins.",
      "You need a loop that repeats exactly 5 times — which loop type is best for a known number of iterations?",
      "Inside the loop, you need to ask for a number. Remember that input() always returns a string — how do you fix that?",
      "Try creating a variable called `total = 0` before your loop. Inside the loop, add each number to it with `total = total + number`.",
      "Your structure should be: total = 0, then a for loop with int(input()), updating total each time, then print(total) after the loop.",
    ],
    modelAnswerTemplate:
      "total = 0\nfor i in range(5):\n    num = int(input('Enter a number: '))\n    total = total + num\nprint('Total:', total)",
  },
];
```

**Step 6: Seed runner**

```typescript
// src/seed/index.ts
import { Module, QuestionTemplate } from "@gcse/database";
import { seedModules } from "./modules";
import { seedTemplates } from "./templates";

export async function runSeedIfEmpty() {
  const moduleCount = await Module.countDocuments();
  if (moduleCount > 0) {
    console.log("Seed already applied — skipping");
    return;
  }

  console.log("Seeding modules...");
  const insertedModules = await Module.insertMany(seedModules);
  console.log(`Seeded ${insertedModules.length} modules`);

  // Map moduleCode → _id for template linking
  const moduleMap = new Map(
    insertedModules.map((m) => [m.moduleCode, m._id]),
  );

  const templatesWithModuleIds = seedTemplates
    .map((t) => {
      const moduleId = moduleMap.get(t.moduleCode);
      if (!moduleId) return null;
      const { moduleCode: _, ...rest } = t;
      return { ...rest, moduleId };
    })
    .filter(Boolean);

  await QuestionTemplate.insertMany(templatesWithModuleIds);
  console.log(`Seeded ${templatesWithModuleIds.length} question templates`);
}
```

**Step 7: Install and run API**

```bash
cd apps/api && pnpm install
pnpm dev
```

Expected: Server starts on port 3001, connects to MongoDB, runs seed on first boot.

**Step 8: Verify health endpoint**

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

---

## Task 7: Set up apps/web (Next.js + tRPC client)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/trpc/client.ts`
- Create: `apps/web/src/trpc/server.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/middleware.ts`

**Step 1: package.json**

```json
{
  "name": "@gcse/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@gcse/trpc": "workspace:*",
    "@tanstack/react-query": "^5.35.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: tRPC client setup**

```typescript
// src/trpc/client.ts
"use client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@gcse/trpc/client";

export const trpc = createTRPCReact<AppRouter>();
```

**Step 3: Providers (TanStack Query + tRPC)**

```tsx
// src/app/providers.tsx
"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "~/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
          fetch(url, options) {
            return fetch(url, { ...options, credentials: "include" });
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 4: Root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GCSE CS Revision",
  description: "GCSE Computer Science revision and Python practice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 5: Auth middleware (redirect unauthenticated users)**

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("gcse_token");
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 6: Install Next.js and init**

```bash
cd apps/web && pnpm install
```

---

## Task 8: Auth hooks + pages

**Files:**
- Create: `apps/web/src/hooks/api/auth.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/signup/page.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`

**Step 1: Auth hooks**

```typescript
// src/hooks/api/auth.tsx
import { trpc } from "~/trpc/client";
import { useRouter } from "next/navigation";

//#region  //*=========== Mutations ===========

export const useLogin = () => {
  const utils = trpc.useUtils();
  return trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
};

export const useSignup = () => {
  return trpc.auth.signup.useMutation();
};

export const useLogout = () => {
  const utils = trpc.useUtils();
  const router = useRouter();
  return trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.reset();
      router.push("/login");
    },
  });
};

export const useCreateStudent = () => {
  const utils = trpc.useUtils();
  return trpc.auth.createStudent.useMutation({
    onSuccess: async () => {
      await utils.auth.getStudents.invalidate();
    },
  });
};

export const useUpdateProfile = () => {
  const utils = trpc.useUtils();
  return trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
};

//#endregion  //*======== Mutations ===========

//#region  //*=========== Queries ===========

export const useMe = () => {
  const query = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });
  return {
    user: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useStudents = () => {
  const query = trpc.auth.getStudents.useQuery();
  return {
    students: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};

//#endregion  //*======== Queries ===========
```

**Step 2: Auth layout**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

**Step 3: Login page**

```tsx
// src/app/(auth)/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "~/hooks/api/auth";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ email, password });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h1>
      <p className="text-slate-500 mb-6">Sign in to continue your revision</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        No account?{" "}
        <Link href="/signup" className="text-indigo-600 hover:underline">
          Sign up as a parent
        </Link>
      </p>
    </div>
  );
}
```

**Step 4: Signup page**

```tsx
// src/app/(auth)/signup/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignup } from "~/hooks/api/auth";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    aiModelPreference: "balanced" as "accurate" | "balanced" | "budget",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signup.mutateAsync(form);
      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.message || "Sign up failed");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Create parent account</h1>
      <p className="text-slate-500 mb-6">You'll add student profiles after signing up</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">AI quality</label>
          <select
            value={form.aiModelPreference}
            onChange={(e) => setForm({ ...form, aiModelPreference: e.target.value as any })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="accurate">Accurate (best quality)</option>
            <option value="balanced">Balanced (recommended)</option>
            <option value="budget">Budget (faster, cheaper)</option>
          </select>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {signup.isPending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

---

## Task 9: Student dashboard

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Create: `apps/web/src/app/(dashboard)/layout.tsx`
- Create: `apps/web/src/hooks/api/modules.tsx`
- Create: `apps/web/src/components/module-card.tsx`
- Create: `apps/web/src/components/nav.tsx`

**Step 1: Modules hook**

```typescript
// src/hooks/api/modules.tsx
import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useListModules = (filters?: {
  examBoard?: "OCR" | "AQA" | "Edexcel" | "generic";
  topicType?: "theory" | "programming" | "mixed";
}) => {
  const query = trpc.modules.listModules.useQuery(filters ?? {});
  return {
    modules: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};

export const useGetModule = (id: string) => {
  const query = trpc.modules.getModuleById.useQuery(
    { id },
    { enabled: !!id },
  );
  return {
    module: query.data,
    isLoading: query.isLoading,
  };
};

//#endregion  //*======== Queries ===========
```

**Step 2: Nav component**

```tsx
// src/components/nav.tsx
"use client";
import Link from "next/link";
import { useLogout, useMe } from "~/hooks/api/auth";

export function Nav() {
  const { user } = useMe();
  const logout = useLogout();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-indigo-600 text-lg">
          GCSE CS
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">Home</Link>
          <Link href="/modules" className="text-slate-600 hover:text-slate-900">Modules</Link>
          <Link href="/history" className="text-slate-600 hover:text-slate-900">History</Link>
          <Link href="/progress" className="text-slate-600 hover:text-slate-900">Progress</Link>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">{user?.fullName}</span>
            <button
              onClick={() => logout.mutate()}
              className="text-slate-400 hover:text-slate-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**Step 3: Module card component**

```tsx
// src/components/module-card.tsx
import Link from "next/link";

interface ModuleCardProps {
  id: string;
  moduleName: string;
  topicName: string;
  topicType: "theory" | "programming" | "mixed";
  description: string;
  difficultyBands: string[];
}

const typeColors = {
  theory: "bg-blue-100 text-blue-700",
  programming: "bg-green-100 text-green-700",
  mixed: "bg-purple-100 text-purple-700",
};

export function ModuleCard({
  id,
  moduleName,
  topicName,
  topicType,
  description,
  difficultyBands,
}: ModuleCardProps) {
  return (
    <Link href={`/modules/${id}`}>
      <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {moduleName}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[topicType]}`}>
            {topicType}
          </span>
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">{topicName}</h3>
        <p className="text-sm text-slate-500 line-clamp-2">{description}</p>
        <div className="mt-3 flex gap-1">
          {difficultyBands.map((d) => (
            <span key={d} className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {d}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

**Step 4: Dashboard layout**

```tsx
// src/app/(dashboard)/layout.tsx
import { Nav } from "~/components/nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
```

**Step 5: Dashboard page**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
"use client";
import { useMe } from "~/hooks/api/auth";
import { useListModules } from "~/hooks/api/modules";
import { ModuleCard } from "~/components/module-card";
import { useState } from "react";

type FilterType = "all" | "theory" | "programming" | "mixed";

export default function DashboardPage() {
  const { user } = useMe();
  const [filter, setFilter] = useState<FilterType>("all");
  const { modules, isLoading } = useListModules(
    filter === "all"
      ? { examBoard: user?.examBoardPreference as any }
      : { topicType: filter, examBoard: user?.examBoardPreference as any },
  );

  return (
    <div>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Hi {user?.fullName?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1">What would you like to study today?</p>
        {user?.examBoardPreference && (
          <span className="inline-block mt-2 text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
            {user.examBoardPreference} exam board
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["all", "theory", "programming", "mixed"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Module grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              id={m.id}
              moduleName={m.moduleName}
              topicName={m.topicName}
              topicType={m.topicType}
              description={m.description}
              difficultyBands={m.difficultyBands}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Task 10: End-to-end smoke test

**Step 1: Start all services**

```bash
# Terminal 1
cd apps/api && pnpm dev

# Terminal 2
cd apps/web && pnpm dev
```

**Step 2: Verify the flow works**

1. Open `http://localhost:3000` — redirects to `/login`
2. Go to `/signup` — create a parent account
3. Log in — redirects to `/dashboard`
4. Dashboard shows 9 module cards (from seed)
5. Filter buttons filter by type
6. Clicking a module card navigates to `/modules/:id`
7. `GET /health` returns `{"status":"ok"}`

**Step 3: Verify DB state**

```bash
# Connect to MongoDB and check collections
mongosh mongodb://localhost:27017/gcse --eval "db.modules.countDocuments()"
```

Expected: `9`

```bash
mongosh mongodb://localhost:27017/gcse --eval "db.question_templates.countDocuments()"
```

Expected: `2` or more depending on how many templates are seeded

---

## What's Next

Phase 2 plan covers:
- `questions.generateQuestion` tRPC procedure
- `theory-marking-service` using Claude Haiku
- Theory question screen UI
- `questions.submitAnswer` + attempt storage
- History page (list by module)

Phase 3 plan covers:
- CodeMirror 6 editor component
- `code-execution-service` with Pyodide
- `coding-assessment-service` AI fallback
- Coding question screen
- Hint ladder UI
