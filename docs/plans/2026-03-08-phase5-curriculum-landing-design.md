# Phase 5: Curriculum View, Landing Page & Form Fixes — Design

**Date:** 2026-03-08

## Overview

Three improvements:
1. Detailed curriculum/submodule view per exam board (starting with Edexcel), progress-integrated
2. Proper public landing page before auth
3. Form input text colour fix (light gray → black)

---

## 1. Data Model

### New: `SpecTopic` collection (`packages/database/src/models/spec-topic.ts`)

```ts
ISpecTopic {
  code: string            // e.g. "1.1.1"
  title: string           // e.g. "Decomposition"
  examBoard: "OCR" | "AQA" | "Edexcel"
  paper: "01" | "02"     // 01 = Theory, 02 = Programming
  topicGroup: string      // e.g. "1.1"
  topicGroupTitle: string // e.g. "Computational Thinking"
  sortOrder: number
}
```

Unique index on `{ code, examBoard }`.

### No changes to `Module`

Existing `specReferences: string[]` on modules already links them to spec topic codes. No migration needed.

### Seed script

`packages/database/src/seeds/edexcel-spec.ts` — exports `seedEdexcelSpec()` that upserts all ~50 Edexcel GCSE CS subtopics (1.1.1–6.6.3). Exposed via `pnpm seed:edexcel` script.

### Progress mapping (client-side)

Curriculum page joins data client-side:
- Fetch spec topics via `curriculum.getByExamBoard`
- Each topic includes `moduleIds[]` (modules that reference this topic code)
- Fetch `progress.getSummary()` (already exists)
- Map: `moduleProgress[].moduleId` → module's `specReferences` → topic codes → mastery score per topic

---

## 2. tRPC Routes

### New router: `curriculum`

**`curriculum.getByExamBoard({ examBoard })`**
- Public query (no auth required for browsing)
- Returns all `SpecTopic` docs for the exam board, sorted by `sortOrder`
- Each topic enriched with `moduleIds: string[]` — modules whose `specReferences` includes this topic code
- Registered as `curriculum: curriculumRouter` in `packages/trpc/src/server/index.ts`

---

## 3. Frontend Pages

### `/curriculum` (authenticated)

- Exam board selector at top (defaults to `user.examBoardPreference`)
- Topics grouped by `topicGroupTitle` (Topic 1–6), each group collapsible
- Each subtopic row:
  - Spec code badge (e.g. `1.1.1`)
  - Title
  - Mastery score bar (if student has attempted related modules)
  - "Practice →" link (navigates to dashboard with module filter, or directly to module)
  - Dimmed "Coming soon" if no modules reference this topic
- Navigation link added to sidebar

### `/` landing page (public)

- Replaces current root redirect to auth
- Hero: app name + tagline + "Get started free" / "Log in" CTA buttons
- 3 feature cards: "Exam board aligned", "AI feedback on every answer", "Track your progress"
- Indigo colour palette consistent with app
- Root layout handles public vs authenticated routing:
  - Unauthenticated users see landing page at `/`
  - Authenticated users redirected to `/dashboard`

### Form text colour fix

- All `<input>` and `<select>` elements: add `text-slate-900` to className
- Affected files: login page, signup page, student creation form in parent dashboard
- Optionally add global rule in `globals.css` for `input, select { color: theme(colors.slate.900) }`

---

## 4. Edexcel Spec Topics (seed data)

All 50 subtopics from Edexcel 1CP2 spec:

**Topic 1 — Computational Thinking (Paper 01)**
- 1.1.1 Decomposition, 1.1.2 Abstraction, 1.1.3 Algorithmic thinking
- 1.2.1 Sequence/selection/iteration, 1.2.2 Input/output/process, 1.2.3 Variables/constants
- 1.3.1 Sorting algorithms, 1.3.2 Searching algorithms
- 1.4.1 Truth tables AND/OR/NOT/XOR, 1.4.2 Logic circuits

**Topic 2 — Data (Paper 01)**
- 2.1.1 Binary/denary/hex conversion, 2.1.2 Binary arithmetic, 2.1.3 Sign/magnitude and two's complement, 2.1.4 Binary shifts
- 2.2.1 Characters (ASCII/Unicode), 2.2.2 Images (pixels/colour depth/resolution), 2.2.3 Sound (sample rate/bit depth), 2.2.4 Compression (lossy/lossless/RLE/Huffman)
- 2.3.1 Units (bits/bytes/KB/MB), 2.3.2 Storage media

**Topic 3 — Computers (Paper 01)**
- 3.1.1 CPU components (ALU/CU/registers/cache), 3.1.2 Von Neumann / Harvard, 3.1.3 Fetch-decode-execute, 3.1.4 Performance factors
- 3.2.1 Primary/secondary storage, 3.2.2 Storage types comparison
- 3.3.1 Input/output/storage devices, 3.3.2 Embedded systems
- 3.4.1 OS functions, 3.4.2 Utility software, 3.4.3 Open/closed source
- 3.5.1 High/low level languages, 3.5.2 Translators (compiler/interpreter/assembler), 3.5.3 IDE features

**Topic 4 — Networks (Paper 01)**
- 4.1.1 LAN/WAN, 4.1.2 Network hardware, 4.1.3 Topologies, 4.1.4 Client-server vs peer-to-peer, 4.1.5 Protocols (TCP/IP, HTTP, FTP, SMTP), 4.1.6 Layers
- 4.2.1 Threats (malware/phishing/brute force), 4.2.2 Security measures (firewall/encryption/authentication)

**Topic 5 — Issues and Impact (Paper 01)**
- 5.1.1 Environmental impact
- 5.2.1 Ethical issues, 5.2.2 Legal issues (Computer Misuse Act, DPA, Copyright)
- 5.3.1 Cybersecurity threats, 5.3.2 Prevention measures

**Topic 6 — Problem Solving with Programming (Paper 02)**
- 6.1.1 Develop code, 6.1.2 Interpret/correct code
- 6.2.1 Sequence, 6.2.2 Selection (if/elif/else), 6.2.3 Iteration (for/while)
- 6.3.1 Integers/floats/strings/booleans, 6.3.2 Lists/2D lists, 6.3.3 Records/files
- 6.4.1 Input/output/import, 6.4.2 String manipulation
- 6.5.1 Arithmetic/comparison/logical/assignment operators
- 6.6.1 Functions/procedures, 6.6.2 Parameters/return values, 6.6.3 Local/global variables

---

## Success Criteria

- [ ] Curriculum page shows all 50 Edexcel spec topics grouped by Topic 1–6
- [ ] Topics with available modules show "Practice →" link
- [ ] Student's mastery score shown per topic if they've attempted related modules
- [ ] Landing page shows at `/` for unauthenticated visitors with hero + 3 features + CTA
- [ ] Authenticated users redirected from `/` to `/dashboard`
- [ ] All form inputs show `text-slate-900` (black) text
