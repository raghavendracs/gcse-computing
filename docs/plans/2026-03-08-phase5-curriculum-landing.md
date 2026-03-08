# Phase 5: Curriculum View, Landing Page & Form Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a progress-integrated Edexcel curriculum browser, a public marketing landing page, and fix form input text colour to black.

**Architecture:** New `SpecTopic` MongoDB model seeded with ~50 Edexcel GCSE CS subtopics; a `curriculum.getByExamBoard` tRPC query enriches each topic with available module IDs; the `/curriculum` page joins spec topics + modules + existing progress summary client-side. The root `/` page becomes a public landing page with auth redirect for logged-in users.

**Tech Stack:** MongoDB/Mongoose, tRPC + Zod, Next.js App Router, TanStack Query, Tailwind CSS, TypeScript

---

## Task 1: Fix form input text colour

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/app/(auth)/signup/page.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx` (parent student creation form)

**Context:** All `<input>` and `<select>` elements currently have no explicit text colour class — they inherit a light gray. Adding `text-slate-900` makes text visibly black.

**Step 1: Update login page inputs**

In `apps/web/app/(auth)/login/page.tsx`, find both `<input>` elements. Each has a `className` that ends with `text-sm`. Add `text-slate-900` to each:

```tsx
// email input className:
className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"

// password input className:
className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
```

**Step 2: Update signup page inputs**

In `apps/web/app/(auth)/signup/page.tsx`, find three `<input>` elements and one `<select>`. Add `text-slate-900` to each:

```tsx
// Full name, email, password inputs — add text-slate-900 to className
// Select — add text-slate-900 to className (alongside existing bg-white)
```

**Step 3: Update parent dashboard student creation form**

In `apps/web/app/(dashboard)/dashboard/page.tsx`, the `ParentDashboard` component renders a form with 3 `<input>` elements and a `<select>`. Each has `focus:ring-indigo-400`. Add `text-slate-900` to each.

**Step 4: Verify visually**

Run `pnpm dev` in `/Users/raghucs/2026-Projects/gsce-coding/apps/web` and check login/signup/parent dashboard forms — typed text should appear black.

---

## Task 2: SpecTopic database model

**Files:**
- Create: `packages/database/src/models/spec-topic.ts`
- Modify: `packages/database/src/index.ts`

**Step 1: Create the model**

Create `packages/database/src/models/spec-topic.ts`:

```typescript
import { Schema, model } from "mongoose";
import { BaseMongodbSchema } from "./_base.model";

export interface ISpecTopic extends BaseMongodbSchema {
  code: string;
  title: string;
  examBoard: "OCR" | "AQA" | "Edexcel";
  paper: "01" | "02";
  topicGroup: string;
  topicGroupTitle: string;
  sortOrder: number;
}

const specTopicSchema = new Schema<ISpecTopic>(
  {
    code: { type: String, required: true },
    title: { type: String, required: true },
    examBoard: { type: String, enum: ["OCR", "AQA", "Edexcel"], required: true },
    paper: { type: String, enum: ["01", "02"], required: true },
    topicGroup: { type: String, required: true },
    topicGroupTitle: { type: String, required: true },
    sortOrder: { type: Number, required: true },
  },
  { timestamps: true },
);

specTopicSchema.index({ examBoard: 1, sortOrder: 1 });
specTopicSchema.index({ code: 1, examBoard: 1 }, { unique: true });

export const SpecTopic = model<ISpecTopic>("spec_topics", specTopicSchema);
export default SpecTopic;
```

**Step 2: Export from database index**

In `packages/database/src/index.ts`, add to the model exports block (after `StudentProgress`):

```typescript
export { SpecTopic } from "./models/spec-topic";
```

And add to the type exports block:

```typescript
export type { ISpecTopic } from "./models/spec-topic";
```

**Step 3: Build to confirm no TS errors**

```bash
cd /Users/raghucs/2026-Projects/gsce-coding
pnpm --filter @gcse/database build
```

Expected: Build succeeds with no errors.

---

## Task 3: Edexcel spec seed script

**Files:**
- Create: `packages/database/src/seeds/edexcel-spec.ts`
- Create: `packages/database/src/seeds/run-seed.ts`
- Modify: `packages/database/package.json`

**Step 1: Create seed data file**

Create `packages/database/src/seeds/edexcel-spec.ts`:

```typescript
import { SpecTopic } from "../models/spec-topic";

const EDEXCEL_TOPICS = [
  // Topic 1: Computational Thinking (Paper 01)
  { code: "1.1.1", title: "Decomposition", topicGroup: "1.1", topicGroupTitle: "Computational Thinking", paper: "01" as const, sortOrder: 101 },
  { code: "1.1.2", title: "Abstraction", topicGroup: "1.1", topicGroupTitle: "Computational Thinking", paper: "01" as const, sortOrder: 102 },
  { code: "1.1.3", title: "Algorithmic thinking", topicGroup: "1.1", topicGroupTitle: "Computational Thinking", paper: "01" as const, sortOrder: 103 },
  { code: "1.2.1", title: "Sequence, selection and iteration", topicGroup: "1.2", topicGroupTitle: "Programming Constructs", paper: "01" as const, sortOrder: 104 },
  { code: "1.2.2", title: "Input, output and process", topicGroup: "1.2", topicGroupTitle: "Programming Constructs", paper: "01" as const, sortOrder: 105 },
  { code: "1.2.3", title: "Variables and constants", topicGroup: "1.2", topicGroupTitle: "Programming Constructs", paper: "01" as const, sortOrder: 106 },
  { code: "1.3.1", title: "Sorting algorithms (bubble, merge, insertion)", topicGroup: "1.3", topicGroupTitle: "Algorithms", paper: "01" as const, sortOrder: 107 },
  { code: "1.3.2", title: "Searching algorithms (linear, binary)", topicGroup: "1.3", topicGroupTitle: "Algorithms", paper: "01" as const, sortOrder: 108 },
  { code: "1.4.1", title: "Truth tables (AND, OR, NOT, XOR)", topicGroup: "1.4", topicGroupTitle: "Logic", paper: "01" as const, sortOrder: 109 },
  { code: "1.4.2", title: "Logic circuits and gate diagrams", topicGroup: "1.4", topicGroupTitle: "Logic", paper: "01" as const, sortOrder: 110 },

  // Topic 2: Data (Paper 01)
  { code: "2.1.1", title: "Binary, denary and hexadecimal conversion", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 201 },
  { code: "2.1.2", title: "Binary arithmetic (addition, overflow)", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 202 },
  { code: "2.1.3", title: "Sign and magnitude, two's complement", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 203 },
  { code: "2.1.4", title: "Binary shifts (left and right)", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 204 },
  { code: "2.2.1", title: "Character encoding (ASCII and Unicode)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 205 },
  { code: "2.2.2", title: "Images (pixels, colour depth, resolution)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 206 },
  { code: "2.2.3", title: "Sound (sample rate, bit depth, Nyquist)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 207 },
  { code: "2.2.4", title: "Compression (lossy, lossless, RLE, Huffman)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 208 },
  { code: "2.3.1", title: "Units of data (bits, bytes, KB, MB, GB, TB)", topicGroup: "2.3", topicGroupTitle: "Storage", paper: "01" as const, sortOrder: 209 },
  { code: "2.3.2", title: "Storage media and their characteristics", topicGroup: "2.3", topicGroupTitle: "Storage", paper: "01" as const, sortOrder: 210 },

  // Topic 3: Computers (Paper 01)
  { code: "3.1.1", title: "CPU components (ALU, CU, registers, cache)", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 301 },
  { code: "3.1.2", title: "Von Neumann and Harvard architectures", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 302 },
  { code: "3.1.3", title: "Fetch-decode-execute cycle", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 303 },
  { code: "3.1.4", title: "CPU performance factors (clock speed, cores, cache)", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 304 },
  { code: "3.2.1", title: "Primary and secondary storage", topicGroup: "3.2", topicGroupTitle: "Memory & Storage", paper: "01" as const, sortOrder: 305 },
  { code: "3.2.2", title: "Comparing storage types (HDD, SSD, optical, flash)", topicGroup: "3.2", topicGroupTitle: "Memory & Storage", paper: "01" as const, sortOrder: 306 },
  { code: "3.3.1", title: "Input, output and storage devices", topicGroup: "3.3", topicGroupTitle: "Hardware Devices", paper: "01" as const, sortOrder: 307 },
  { code: "3.3.2", title: "Embedded systems and their uses", topicGroup: "3.3", topicGroupTitle: "Hardware Devices", paper: "01" as const, sortOrder: 308 },
  { code: "3.4.1", title: "Operating system functions", topicGroup: "3.4", topicGroupTitle: "Software", paper: "01" as const, sortOrder: 309 },
  { code: "3.4.2", title: "Utility software", topicGroup: "3.4", topicGroupTitle: "Software", paper: "01" as const, sortOrder: 310 },
  { code: "3.4.3", title: "Open source vs closed source software", topicGroup: "3.4", topicGroupTitle: "Software", paper: "01" as const, sortOrder: 311 },
  { code: "3.5.1", title: "High-level and low-level programming languages", topicGroup: "3.5", topicGroupTitle: "Programming Languages", paper: "01" as const, sortOrder: 312 },
  { code: "3.5.2", title: "Translators: compiler, interpreter, assembler", topicGroup: "3.5", topicGroupTitle: "Programming Languages", paper: "01" as const, sortOrder: 313 },
  { code: "3.5.3", title: "IDE features (editor, debugger, translator)", topicGroup: "3.5", topicGroupTitle: "Programming Languages", paper: "01" as const, sortOrder: 314 },

  // Topic 4: Networks (Paper 01)
  { code: "4.1.1", title: "LAN and WAN", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 401 },
  { code: "4.1.2", title: "Network hardware (router, switch, NIC, WAP)", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 402 },
  { code: "4.1.3", title: "Network topologies (bus, star, mesh)", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 403 },
  { code: "4.1.4", title: "Client-server vs peer-to-peer", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 404 },
  { code: "4.1.5", title: "Protocols (TCP/IP, HTTP, HTTPS, FTP, SMTP, IMAP)", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 405 },
  { code: "4.1.6", title: "Network layers and the TCP/IP model", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 406 },
  { code: "4.2.1", title: "Threats (malware, phishing, brute force, DDoS)", topicGroup: "4.2", topicGroupTitle: "Network Security", paper: "01" as const, sortOrder: 407 },
  { code: "4.2.2", title: "Security measures (firewall, encryption, authentication)", topicGroup: "4.2", topicGroupTitle: "Network Security", paper: "01" as const, sortOrder: 408 },

  // Topic 5: Issues and Impact (Paper 01)
  { code: "5.1.1", title: "Environmental impact of computing", topicGroup: "5.1", topicGroupTitle: "Environmental Issues", paper: "01" as const, sortOrder: 501 },
  { code: "5.2.1", title: "Ethical issues in computing", topicGroup: "5.2", topicGroupTitle: "Ethical & Legal Issues", paper: "01" as const, sortOrder: 502 },
  { code: "5.2.2", title: "Legal issues (Computer Misuse Act, DPA, Copyright)", topicGroup: "5.2", topicGroupTitle: "Ethical & Legal Issues", paper: "01" as const, sortOrder: 503 },
  { code: "5.3.1", title: "Cybersecurity threats and attack types", topicGroup: "5.3", topicGroupTitle: "Cybersecurity", paper: "01" as const, sortOrder: 504 },
  { code: "5.3.2", title: "Cybersecurity prevention and protection measures", topicGroup: "5.3", topicGroupTitle: "Cybersecurity", paper: "01" as const, sortOrder: 505 },

  // Topic 6: Problem Solving with Programming (Paper 02)
  { code: "6.1.1", title: "Develop code to solve problems", topicGroup: "6.1", topicGroupTitle: "Developing Code", paper: "02" as const, sortOrder: 601 },
  { code: "6.1.2", title: "Interpret, correct and complete code", topicGroup: "6.1", topicGroupTitle: "Developing Code", paper: "02" as const, sortOrder: 602 },
  { code: "6.2.1", title: "Sequence", topicGroup: "6.2", topicGroupTitle: "Programming Constructs", paper: "02" as const, sortOrder: 603 },
  { code: "6.2.2", title: "Selection (if, elif, else)", topicGroup: "6.2", topicGroupTitle: "Programming Constructs", paper: "02" as const, sortOrder: 604 },
  { code: "6.2.3", title: "Iteration (for loops, while loops)", topicGroup: "6.2", topicGroupTitle: "Programming Constructs", paper: "02" as const, sortOrder: 605 },
  { code: "6.3.1", title: "Integers, floats, strings and booleans", topicGroup: "6.3", topicGroupTitle: "Data Types & Structures", paper: "02" as const, sortOrder: 606 },
  { code: "6.3.2", title: "Lists and 2D lists", topicGroup: "6.3", topicGroupTitle: "Data Types & Structures", paper: "02" as const, sortOrder: 607 },
  { code: "6.3.3", title: "Records and file handling", topicGroup: "6.3", topicGroupTitle: "Data Types & Structures", paper: "02" as const, sortOrder: 608 },
  { code: "6.4.1", title: "Input, output and importing modules", topicGroup: "6.4", topicGroupTitle: "I/O and String Handling", paper: "02" as const, sortOrder: 609 },
  { code: "6.4.2", title: "String manipulation (slicing, methods, formatting)", topicGroup: "6.4", topicGroupTitle: "I/O and String Handling", paper: "02" as const, sortOrder: 610 },
  { code: "6.5.1", title: "Arithmetic, comparison, logical and assignment operators", topicGroup: "6.5", topicGroupTitle: "Operators", paper: "02" as const, sortOrder: 611 },
  { code: "6.6.1", title: "Functions and procedures", topicGroup: "6.6", topicGroupTitle: "Subprograms", paper: "02" as const, sortOrder: 612 },
  { code: "6.6.2", title: "Parameters and return values", topicGroup: "6.6", topicGroupTitle: "Subprograms", paper: "02" as const, sortOrder: 613 },
  { code: "6.6.3", title: "Local and global variables", topicGroup: "6.6", topicGroupTitle: "Subprograms", paper: "02" as const, sortOrder: 614 },
];

export async function seedEdexcelSpec(): Promise<void> {
  console.log("Seeding Edexcel GCSE CS spec topics...");
  for (const topic of EDEXCEL_TOPICS) {
    await SpecTopic.findOneAndUpdate(
      { code: topic.code, examBoard: "Edexcel" },
      { ...topic, examBoard: "Edexcel" },
      { upsert: true, new: true },
    );
  }
  console.log(`Seeded ${EDEXCEL_TOPICS.length} Edexcel spec topics.`);
}
```

**Step 2: Create run-seed entry point**

Create `packages/database/src/seeds/run-seed.ts`:

```typescript
import { connectToDatabase, disconnectFromDatabase } from "../connection";
import { seedEdexcelSpec } from "./edexcel-spec";

async function main() {
  await connectToDatabase(process.env.MONGODB_URI!);
  await seedEdexcelSpec();
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 3: Add seed script to package.json**

In `packages/database/package.json`, add to `"scripts"`:

```json
"seed:edexcel": "tsx src/seeds/run-seed.ts"
```

**Step 4: Build to confirm no TS errors**

```bash
cd /Users/raghucs/2026-Projects/gsce-coding
pnpm --filter @gcse/database build
```

Expected: Build succeeds.

---

## Task 4: Curriculum tRPC route

**Files:**
- Create: `packages/trpc/src/server/routes/curriculum/models.ts`
- Create: `packages/trpc/src/server/routes/curriculum/route.ts`
- Modify: `packages/trpc/src/server/index.ts`

**Step 1: Create models**

Create `packages/trpc/src/server/routes/curriculum/models.ts`:

```typescript
import { z } from "zod";

export const getByExamBoardInputModel = z.object({
  examBoard: z.enum(["OCR", "AQA", "Edexcel"]),
});

const specTopicModel = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  paper: z.enum(["01", "02"]),
  topicGroup: z.string(),
  topicGroupTitle: z.string(),
  sortOrder: z.number(),
  moduleIds: z.array(z.string()),
});

export const getByExamBoardOutputModel = z.array(specTopicModel);
```

**Step 2: Create route**

Create `packages/trpc/src/server/routes/curriculum/route.ts`:

```typescript
import { SpecTopic, Module } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import { getByExamBoardInputModel, getByExamBoardOutputModel } from "./models";

export const curriculumRouter = router({
  getByExamBoard: authenticatedProcedure
    .input(getByExamBoardInputModel)
    .output(getByExamBoardOutputModel)
    .query(async ({ input }) => {
      const topics = await SpecTopic.find({ examBoard: input.examBoard }).sort({ sortOrder: 1 });
      const modules = await Module.find({ examBoard: input.examBoard }).select("_id specReferences");

      return topics.map((topic) => {
        const moduleIds = modules
          .filter((m) => m.specReferences.includes(topic.code))
          .map((m) => m._id.toString());

        return {
          id: topic._id.toString(),
          code: topic.code,
          title: topic.title,
          paper: topic.paper,
          topicGroup: topic.topicGroup,
          topicGroupTitle: topic.topicGroupTitle,
          sortOrder: topic.sortOrder,
          moduleIds,
        };
      });
    }),
});
```

**Step 3: Register router**

In `packages/trpc/src/server/index.ts`, add:

```typescript
import { curriculumRouter } from "./routes/curriculum/route";

export const appRouter = router({
  auth: authRouter,
  modules: modulesRouter,
  questions: questionsRouter,
  sessions: sessionsRouter,
  history: historyRouter,
  progress: progressRouter,
  curriculum: curriculumRouter,  // add this line
});
```

**Step 4: Build tRPC package**

```bash
cd /Users/raghucs/2026-Projects/gsce-coding
pnpm --filter @gcse/trpc build
```

Expected: Build succeeds.

---

## Task 5: Curriculum frontend hook

**Files:**
- Create: `apps/web/hooks/api/curriculum.tsx`

**Step 1: Create hook**

Create `apps/web/hooks/api/curriculum.tsx`:

```typescript
import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useGetCurriculum = (examBoard: "OCR" | "AQA" | "Edexcel" | undefined) => {
  const query = trpc.curriculum.getByExamBoard.useQuery(
    { examBoard: examBoard! },
    { enabled: !!examBoard },
  );
  return {
    topics: query.data ?? [],
    isLoading: query.isLoading,
  };
};

//#endregion  //*======== Queries ===========
```

---

## Task 6: Curriculum page and nav link

**Files:**
- Create: `apps/web/app/(dashboard)/curriculum/page.tsx`
- Modify: `apps/web/components/nav.tsx`

**Step 1: Create curriculum page**

Create `apps/web/app/(dashboard)/curriculum/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useMe } from "~/hooks/api/auth";
import { useGetCurriculum } from "~/hooks/api/curriculum";
import { useGetProgress } from "~/hooks/api/progress";

type ExamBoard = "OCR" | "AQA" | "Edexcel";

function MasteryBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const colour = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export default function CurriculumPage() {
  const { user } = useMe();
  const [examBoard, setExamBoard] = useState<ExamBoard>(
    (user?.examBoardPreference as ExamBoard) ?? "Edexcel",
  );
  const { topics, isLoading } = useGetCurriculum(examBoard);
  const { progress } = useGetProgress();

  // Build a map: moduleId -> averageScore from progress
  const moduleScoreMap = new Map<string, number>();
  if (progress) {
    for (const mp of progress.moduleProgress) {
      moduleScoreMap.set(mp.moduleId, mp.averageScore);
    }
  }

  // For each topic, compute mastery: average of scores for modules referencing this topic
  function topicMastery(moduleIds: string[]): number | null {
    if (moduleIds.length === 0) return null;
    const scores = moduleIds.map((id) => moduleScoreMap.get(id)).filter((s): s is number => s !== undefined);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Group topics by topicGroupTitle
  const groups = topics.reduce<Record<string, typeof topics>>((acc, topic) => {
    const key = topic.topicGroupTitle;
    if (!acc[key]) acc[key] = [];
    acc[key].push(topic);
    return acc;
  }, {});

  // Derive topic number groups (1.x, 2.x etc.) for section headers
  const topicSections = topics.reduce<Record<string, string>>((acc, t) => {
    const section = t.code.split(".")[0];
    if (!acc[section]) {
      // Use topicGroupTitle of the first subtopic in this section as section label
      const sectionLabel: Record<string, string> = {
        "1": "Topic 1 — Computational Thinking",
        "2": "Topic 2 — Data",
        "3": "Topic 3 — Computers",
        "4": "Topic 4 — Networks",
        "5": "Topic 5 — Issues and Impact",
        "6": "Topic 6 — Problem Solving with Programming",
      };
      acc[section] = sectionLabel[section] ?? `Topic ${section}`;
    }
    return acc;
  }, {});

  // Group by top-level topic number
  const sections = Object.entries(topicSections).map(([num, label]) => ({
    num,
    label,
    subtopicGroups: Object.entries(
      topics
        .filter((t) => t.code.startsWith(`${num}.`))
        .reduce<Record<string, typeof topics>>((acc, t) => {
          if (!acc[t.topicGroupTitle]) acc[t.topicGroupTitle] = [];
          acc[t.topicGroupTitle].push(t);
          return acc;
        }, {}),
    ),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Curriculum</h1>
          <p className="text-slate-500 mt-1">Full spec breakdown with your progress</p>
        </div>
        <div className="flex gap-2">
          {(["Edexcel", "AQA", "OCR"] as ExamBoard[]).map((board) => (
            <button
              key={board}
              onClick={() => setExamBoard(board)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                examBoard === board
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              {board}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No curriculum data yet</p>
          <p className="text-sm mt-1">Spec topics for {examBoard} haven&apos;t been seeded yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(({ num, label, subtopicGroups }) => (
            <div key={num} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h2 className="font-semibold text-slate-800">{label}</h2>
                <span className="text-xs text-slate-400">
                  {num === "6" ? "Paper 02 — Programming" : "Paper 01 — Theory"}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {subtopicGroups.map(([groupTitle, groupTopics]) => (
                  <div key={groupTitle}>
                    <div className="px-5 py-2 bg-slate-25">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{groupTitle}</p>
                    </div>
                    {groupTopics.map((topic) => {
                      const mastery = topicMastery(topic.moduleIds);
                      const hasModules = topic.moduleIds.length > 0;
                      return (
                        <div key={topic.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                          <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold shrink-0">
                            {topic.code}
                          </span>
                          <span className={`flex-1 text-sm ${hasModules ? "text-slate-800" : "text-slate-400"}`}>
                            {topic.title}
                          </span>
                          {mastery !== null ? (
                            <MasteryBar score={mastery} />
                          ) : hasModules ? (
                            <span className="text-xs text-slate-400 w-24 text-right">Not attempted</span>
                          ) : (
                            <span className="text-xs text-slate-300 w-24 text-right">Coming soon</span>
                          )}
                          {hasModules && (
                            <Link
                              href={`/dashboard?spec=${topic.code}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
                            >
                              Practice →
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add Curriculum link to nav**

In `apps/web/components/nav.tsx`, add `{ href: "/curriculum", label: "Curriculum" }` to the `navLinks` array:

```typescript
const navLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/curriculum", label: "Curriculum" },
  { href: "/modules", label: "Modules" },
  { href: "/history", label: "History" },
  { href: "/progress", label: "Progress" },
];
```

---

## Task 7: Landing page

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/(landing)/layout.tsx` (route group for landing-only layout)

**Context:** Currently `app/page.tsx` is a server component that unconditionally redirects to `/dashboard`. We need it to show a marketing page to unauthenticated visitors while still sending logged-in users to `/dashboard`. The simplest approach: make `page.tsx` a client component that checks auth state and redirects if logged in; otherwise renders the landing page. This avoids creating a new route group.

**Step 1: Replace page.tsx**

Replace `apps/web/app/page.tsx` with:

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMe } from "~/hooks/api/auth";

export default function LandingPage() {
  const { user, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  // While checking auth, show nothing (prevents flash)
  if (isLoading) {
    return null;
  }

  // If user is logged in, redirect is in progress
  if (user) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-4 h-14 flex items-center justify-between max-w-5xl mx-auto">
        <span className="font-bold text-indigo-600 text-lg tracking-tight">GCSE CS</span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-4">
          Ace your GCSE<br />
          <span className="text-indigo-600">Computer Science</span>
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-xl mx-auto">
          AI-powered practice questions aligned to your exam board. Get instant feedback, track your progress, and target your weak areas.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/signup"
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-white text-slate-700 rounded-xl font-semibold text-base border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">📋</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Exam board aligned</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Questions mapped directly to the Edexcel, AQA, and OCR GCSE Computer Science specifications. Nothing irrelevant, nothing missing.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">🤖</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">AI feedback on every answer</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Every answer you submit gets detailed AI marking — strengths, missing points, and a score — so you know exactly where to improve.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl">📈</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Track your progress</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              See your mastery per topic, identify weak areas automatically, and keep your revision streak going day by day.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Verify routing**

Visit `http://localhost:3000/` — logged-out users should see the landing page. Log in, then visit `/` — should redirect to `/dashboard`.

---

## Final verification

```bash
cd /Users/raghucs/2026-Projects/gsce-coding
pnpm --filter @gcse/database build
pnpm --filter @gcse/trpc build
```

Both should pass with no TypeScript errors.

To seed Edexcel topics (run once with the API server's MONGODB_URI):

```bash
cd /Users/raghucs/2026-Projects/gsce-coding
MONGODB_URI=<your-uri> pnpm --filter @gcse/database seed:edexcel
```
