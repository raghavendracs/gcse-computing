"use client";
import { useState, useMemo, useEffect } from "react";
import { BookOpen, Code2, Trash2, History, InboxIcon, Lightbulb, Clock, ChevronDown, ChevronRight, ChevronLeft, X, Loader2 } from "lucide-react";
import { useMe, useStudents, useCreateStudent, useDeleteStudent } from "~/hooks/api/auth";
import { useGetCurriculum } from "~/hooks/api/curriculum";
import { useListAttempts, useGetAttemptDetail } from "~/hooks/api/history";
import { useListSessions, useListStudentSessions } from "~/hooks/api/sessions";
import { PracticeSession } from "~/components/PracticeSession";
import { usePracticeTimer } from "~/contexts/PracticeTimerContext";

type ExamBoard = "OCR" | "AQA" | "Edexcel";

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "1.1.1": "Break a complex problem into smaller, more manageable sub-problems that can each be solved independently. A key strategy used in software design, network setup, and algorithm planning.",
  "1.1.2": "Identify and remove unnecessary detail so you can focus on what really matters. Abstraction lets programmers work at a higher level without worrying about low-level implementation.",
  "1.1.3": "Design precise step-by-step solutions, recognise repeated patterns, and generalise solutions that can be reused. Forms the foundation of all algorithm design.",
  "1.2.1": "Programs are built from three constructs: sequence (steps in order), selection (branching with if/else) and iteration (loops). Every algorithm can be expressed using just these three.",
  "1.2.2": "Programs take input from users or files, process it using logic and calculations, and produce output. Understanding this model helps you design and trace programs effectively.",
  "1.2.3": "Variables store values that can change during execution; constants hold fixed values throughout. Choosing meaningful names and correct types is essential for readable, correct programs.",
  "1.3.1": "Bubble sort repeatedly swaps adjacent elements; insertion sort builds a sorted list one item at a time; merge sort divides and conquers. Compare their time complexity and best/worst cases.",
  "1.3.2": "Linear search checks every element one by one — simple but slow on large datasets. Binary search repeatedly halves a sorted list, making it far more efficient for large, ordered data.",
  "1.4.1": "Boolean logic underpins all computing decisions. AND returns true only if both inputs are true; OR if either is; NOT inverts; XOR if inputs differ. Practise completing truth tables for combined expressions.",
  "1.4.2": "Logic gates are physical components that implement Boolean operations. You need to draw, trace and analyse circuits containing AND, OR, NOT and XOR gates, including multi-gate combinations.",
  "2.1.1": "Denary (base 10) is everyday numbering; binary (base 2) is used by computers; hexadecimal (base 16) is a compact way to represent binary. Convert fluently between all three systems.",
  "2.1.2": "Add two binary numbers column by column, carrying 1 when the sum reaches 2. Overflow occurs when the result exceeds the number of available bits — a common source of program errors.",
  "2.1.3": "Sign and magnitude uses the leading bit as a +/− flag. Two's complement is preferred in hardware: invert all bits and add 1 to negate a number. It simplifies arithmetic circuits.",
  "2.1.4": "A left shift multiplies a binary value by 2 for each position shifted; a right shift divides by 2. Shifts can cause overflow or loss of precision — important in low-level and embedded programming.",
  "2.2.1": "ASCII uses 7 bits to encode 128 characters; extended ASCII uses 8 bits. Unicode (UTF-8/16/32) covers over a million characters worldwide. Understand how character codes map to binary values.",
  "2.2.2": "Each pixel stores colour as a binary value. Higher colour depth means more bits per pixel and more colours; higher resolution means more pixels. Both increase file size — calculate storage requirements.",
  "2.2.3": "Sample rate is how often sound is measured per second (Hz); bit depth is how many bits store each sample. Nyquist's theorem states sample rate must be at least twice the highest frequency.",
  "2.2.4": "Lossy compression permanently removes data to shrink files (e.g. JPEG, MP3). Lossless keeps all data (e.g. PNG, FLAC). RLE stores runs of identical values; Huffman assigns shorter codes to common symbols.",
  "2.3.1": "1 byte = 8 bits; 1 KB = 1024 bytes; 1 MB = 1024 KB, and so on up to GB and TB. Calculate file sizes and storage requirements for images, audio and text data.",
  "2.3.2": "HDDs use spinning magnetic platters — cheap and high capacity but slower. SSDs use flash memory — fast and durable but pricier. Optical discs suit archival; flash drives offer portability.",
  "3.1.1": "The ALU performs arithmetic and logic operations. The control unit directs data flow using fetch-decode-execute. Registers are ultra-fast on-chip storage; cache stores frequently used data close to the CPU.",
  "3.1.2": "Von Neumann architecture stores programs and data in the same memory, creating the 'Von Neumann bottleneck'. Harvard architecture uses separate buses for instructions and data, improving throughput in embedded systems.",
  "3.1.3": "Fetch: retrieve the next instruction from memory into the instruction register. Decode: the control unit interprets the instruction. Execute: the ALU or memory carries out the operation. Repeat continuously.",
  "3.1.4": "A higher clock speed means more cycles per second. More cores allow true parallel execution. A larger cache reduces the time spent waiting for data from slower RAM — all three improve performance.",
  "3.2.1": "Primary storage (RAM and ROM) is directly accessible by the CPU — fast but volatile (RAM) or read-only (ROM). Secondary storage (HDD, SSD) is persistent but slower, used for long-term data.",
  "3.2.2": "HDDs: high capacity, low cost, mechanical and slower. SSDs: fast, silent, shock-resistant but costlier. Optical (CD/DVD/Blu-ray): archival and distribution. Flash/USB: portable and convenient.",
  "3.3.1": "Input devices send data to the CPU (keyboard, mouse, microphone, scanner, camera). Output devices receive processed data (monitor, printer, speaker). Storage devices do both. Each uses drivers to communicate.",
  "3.3.2": "Embedded systems are dedicated computers built into appliances, vehicles or medical devices. They run a single fixed program, have limited resources and must operate reliably in real-time environments.",
  "3.4.1": "The OS manages processes (scheduling CPU time), memory (allocation and protection), file systems, device drivers and user interfaces. Without an OS, application software could not run on hardware.",
  "3.4.2": "Utility programs maintain system health: defragmenters reorganise HDD data, anti-virus detects threats, backup tools copy files, compression tools save space, and encryption protects sensitive data.",
  "3.4.3": "Open source software is free to use, modify and distribute — relying on community support. Closed source is owned and licenced — offering professional support and warranty but less flexibility.",
  "3.5.1": "High-level languages (Python, Java) are readable and portable but need translating. Low-level languages (assembly, machine code) run fast and give hardware control but are harder to write and maintain.",
  "3.5.2": "A compiler translates the entire source code to machine code at once — fast to run but slow to compile. An interpreter translates line-by-line at runtime — easier to debug. An assembler converts assembly to machine code.",
  "3.5.3": "IDEs combine a code editor, syntax highlighter, auto-complete, run/debug tools and version control integration. Debuggers let you step through code, set breakpoints and inspect variable values.",
  "4.1.1": "A LAN covers a small geographic area (home, school) using privately owned hardware. A WAN spans large distances (the internet is the world's largest WAN) and often uses leased telecommunications infrastructure.",
  "4.1.2": "Routers direct packets between different networks using IP addresses. Switches connect devices within the same LAN using MAC addresses. NICs provide the physical/wireless interface; WAPs extend wireless coverage.",
  "4.1.3": "Bus topology: all devices share one cable — simple but a single break disrupts the whole network. Star: all connect to a central switch — easy to manage but switch is a single point of failure. Mesh: multiple paths — highly resilient but expensive.",
  "4.1.4": "Client-server: clients request services from a powerful central server — easier to manage and secure. Peer-to-peer: all devices share resources equally — cheaper to set up but harder to secure and administer.",
  "4.1.5": "TCP/IP is the fundamental suite for internet communication. HTTP/HTTPS transfer web pages; FTP transfers files; SMTP sends email; IMAP retrieves email. Each protocol defines rules for data format and error handling.",
  "4.1.6": "The TCP/IP model has four layers: Application (user-facing protocols), Transport (TCP/UDP reliability), Internet (IP addressing and routing) and Link (physical transmission). Data is encapsulated as it moves down the stack.",
  "4.2.1": "Malware includes viruses, worms, ransomware and trojans. Phishing tricks users into revealing credentials. Brute force tries all password combinations. DDoS floods a server with traffic until it crashes.",
  "4.2.2": "Firewalls filter traffic by rules. Encryption (SSL/TLS, AES) scrambles data so only authorised parties can read it. Strong passwords, two-factor authentication and regular patching prevent unauthorised access.",
  "5.1.1": "Data centres consume enormous energy; manufacturing devices creates e-waste containing toxic materials. Carbon footprints of cloud services are growing. Responsible disposal, recycling schemes and renewable energy all help.",
  "5.2.1": "Computers raise concerns about data privacy, algorithmic bias in AI, mass surveillance, widening the digital divide between those with and without access, and the ethical use of personal data collected online.",
  "5.2.2": "The Computer Misuse Act 1990 criminalises unauthorised access and malware creation. GDPR / Data Protection Act 2018 regulates personal data handling. Copyright law protects software and digital content from unlicensed copying.",
  "5.3.1": "Social engineering manipulates people rather than systems. SQL injection exploits database queries. Zero-day vulnerabilities are unknown to vendors. Insider threats come from trusted users misusing their access rights.",
  "5.3.2": "Defence in depth uses multiple layers: firewalls, intrusion detection, encryption, regular patching, strong authentication policies, staff training and incident response plans to minimise the impact of a breach.",
  "6.1.1": "Write Python programs that read inputs, apply logic using selection and iteration, and produce correct outputs. Practice decomposing problems, writing pseudocode first, and testing with different inputs.",
  "6.1.2": "Trace through code line-by-line to predict output; identify and fix syntax errors, logic errors and runtime errors; add missing lines to make a program work correctly as described.",
  "6.2.1": "In a sequence, each statement executes exactly once, in the order written. This is the simplest program structure — understand how to trace sequential code and predict its output step by step.",
  "6.2.2": "if checks a condition; elif checks an alternative if the first was false; else catches everything else. You can nest conditions and combine them with and, or and not to handle complex decisions.",
  "6.2.3": "for loops iterate a fixed number of times using range() or over a collection. while loops continue as long as a condition is true — be careful of infinite loops. Know when to use each and how to trace them.",
  "6.3.1": "int stores whole numbers, float stores decimals, str stores text (must be quoted) and bool stores True or False. Casting (int(), str(), float()) converts between types — essential for processing user input.",
  "6.3.2": "Lists store ordered collections accessed by index (starting at 0). Append, remove, sort and slice lists. 2D lists (lists of lists) represent tables or grids — access elements with list[row][col].",
  "6.3.3": "Records (dictionaries) store key-value pairs for structured data. File handling uses open(), read(), write() and close() (or with statements) to persist data between program runs.",
  "6.4.1": "input() reads a string from the user — cast it to int or float for numeric work. print() outputs values to the screen. import gives access to modules like random and math for extended functionality.",
  "6.4.2": "Strings support indexing and slicing (s[0], s[1:4]). Key methods: len(), upper(), lower(), split(), strip(), replace(). f-strings (f'Hello {name}') let you embed variables directly in output.",
  "6.5.1": "Arithmetic: +, -, *, /, // (integer division), % (remainder), ** (power). Comparison: ==, !=, <, >, <=, >=. Logical: and, or, not. Assignment: =, +=, -=. Know precedence and how they combine in expressions.",
  "6.6.1": "Define functions with def name(): to group reusable code. Call them by name. Procedures don't return a value; functions do. Encapsulating logic in functions makes programs shorter, clearer and easier to test.",
  "6.6.2": "Parameters are placeholders in the function definition; arguments are the actual values passed when calling it. return sends a value back to the caller — without it, the function implicitly returns None.",
  "6.6.3": "Local variables exist only inside their function. Global variables are accessible everywhere but should be used sparingly to avoid hard-to-find bugs. Use the global keyword only when you must modify a global inside a function.",
};

const SECTION_LABELS: Record<string, string> = {
  "1": "Computational Thinking",
  "2": "Data",
  "3": "Computers",
  "4": "Networks",
  "5": "Issues and Impact",
  "6": "Programming",
};

type SelectedTopic = {
  title: string;
  code: string;
  moduleId: string;
  moduleIds: string[];
  paper: "01" | "02";
  groupTitle: string;
};

type ActiveTab = "theory" | "coding" | "previous";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ScorePill({ awarded, max }: { awarded: number; max: number }) {
  const pct = max > 0 ? awarded / max : 0;
  const colour = pct >= 0.7 ? "bg-emerald-100 text-emerald-700" : pct >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colour}`}>
      {awarded}/{max}
    </span>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}


function tableDateParts(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

const PAGE_SIZE = 10;

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return (
    <div className="flex items-center justify-end gap-1 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-30"
        style={{ color: "var(--muted-foreground)" }}
        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      ><ChevronLeft className="w-4 h-4" /></button>
      {pages.map((p) => (
        <button key={p} onClick={() => onPage(p)}
          className="w-7 h-7 flex items-center justify-center rounded text-sm font-medium transition-colors"
          style={{ backgroundColor: p === page ? "#4f46e5" : "transparent", color: p === page ? "#fff" : "var(--muted-foreground)" }}
          onMouseEnter={(e) => { if (p !== page) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
          onMouseLeave={(e) => { if (p !== page) e.currentTarget.style.backgroundColor = "transparent"; }}
        >{p}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-30"
        style={{ color: "var(--muted-foreground)" }}
        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      ><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

type SessionItem = {
  id: string; mode: string; startedAt: string; endedAt?: string;
  durationSeconds?: number;
  summary: { questionsAttempted: number; averageScore: number; hintsUsed: number };
};
type AttemptItem = {
  id: string; questionId: string; moduleId: string; attemptNumber: number; submissionType: string;
  awardedMarks: number; maxMarks: number; feedback: string; missingPoints: string[]; strengths: string[];
  hintsUsedCount: number; timeSpentSeconds: number; createdAt: string;
};

function SessionsPanel({ sessions, isLoading, page, onPage }: {
  sessions: SessionItem[]; isLoading: boolean; page: number; onPage: (p: number) => void;
}) {
  if (isLoading) return (
    <div className="p-5 space-y-2 animate-pulse">
      {[1,2,3,4,5].map((i) => <div key={i} className="h-14 rounded" style={{ backgroundColor: "var(--accent)" }} />)}
    </div>
  );
  if (sessions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--muted-foreground)" }}>
      <Clock className="w-10 h-10 opacity-20" />
      <p className="text-sm font-medium">No sessions yet</p>
    </div>
  );
  const rows = sessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto">
        <div className="w-[90%] mx-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "22%" }}>Date / Time</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "18%" }}>Mode</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "18%" }}>Duration</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Questions</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Score</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Hints</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const pct = s.summary.questionsAttempted > 0 ? s.summary.averageScore : null;
                const scoreColour = pct === null ? "var(--muted-foreground)" : pct >= 0.7 ? "#16a34a" : pct >= 0.5 ? "#d97706" : "#dc2626";
                const { date, time } = tableDateParts(s.startedAt);
                return (
                  <tr key={s.id} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-4 group-hover:opacity-80 transition-opacity">
                      <p className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{date}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{time}</p>
                    </td>
                    <td className="py-4">
                      <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-md" style={{ backgroundColor: s.mode === "coding" ? "#ecfdf5" : "#eff6ff", color: s.mode === "coding" ? "#059669" : "#3b82f6" }}>
                        {s.mode}
                      </span>
                    </td>
                    <td className="py-4 text-sm font-mono" style={{ color: "var(--muted-foreground)" }}>
                      {s.durationSeconds !== undefined ? formatDuration(s.durationSeconds) : "—"}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: "var(--foreground)" }}>{s.summary.questionsAttempted || "—"}</td>
                    <td className="py-4 text-right text-sm font-semibold" style={{ color: scoreColour }}>
                      {pct !== null ? `${Math.round(pct * 100)}%` : "—"}
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: "var(--muted-foreground)" }}>{s.summary.hintsUsed || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} total={sessions.length} onPage={onPage} />
    </div>
  );
}

function AttemptDetailExpanded({ attemptId }: { attemptId: string }) {
  const { attempt, isLoading } = useGetAttemptDetail(attemptId);

  if (isLoading) {
    return (
      <tr>
        <td colSpan={7} className="px-6 py-4">
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-4 rounded" style={{ backgroundColor: "var(--accent)" }} />)}
          </div>
        </td>
      </tr>
    );
  }

  if (!attempt) return null;

  const isCode = attempt.submissionType === "code";

  return (
    <tr>
      <td colSpan={7} style={{ backgroundColor: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
        <div className="px-6 py-4 space-y-4">
          {/* Question */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Question</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{attempt.questionText}</p>
          </div>

          {/* Your answer */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Your answer</p>
            {isCode ? (
              <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "monospace" }}>
                {attempt.submittedAnswer}
              </pre>
            ) : (
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{attempt.submittedAnswer}</p>
            )}
          </div>

          {/* Strengths */}
          {attempt.assessment?.strengths?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#16a34a" }}>Strengths</p>
              <ul className="space-y-0.5">
                {attempt.assessment.strengths.map((s: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "var(--foreground)" }}>
                    <span style={{ color: "#16a34a" }}>✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing points */}
          {attempt.assessment?.missingPoints?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#dc2626" }}>Missing points</p>
              <ul className="space-y-0.5">
                {attempt.assessment.missingPoints.map((p: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "var(--foreground)" }}>
                    <span style={{ color: "#dc2626" }}>✗</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Model answer */}
          {attempt.modelAnswer && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Model answer</p>
              {isCode ? (
                <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "monospace" }}>
                  {attempt.modelAnswer}
                </pre>
              ) : (
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{attempt.modelAnswer}</p>
              )}
            </div>
          )}

          {/* Mark scheme */}
          {(attempt.markSchemePoints?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>Mark scheme</p>
              <ul className="space-y-0.5">
                {attempt.markSchemePoints!.map((pt: string, i: number) => (
                  <li key={i} className="text-sm" style={{ color: "var(--muted-foreground)" }}>• {pt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function AttemptsPanel({ attempts, isLoading, page, onPage, moduleToTopic }: {
  attempts: AttemptItem[]; isLoading: boolean; page: number; onPage: (p: number) => void;
  moduleToTopic: Map<string, { title: string; code: string; groupTitle: string }>;
}) {
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  if (isLoading) return (
    <div className="p-5 space-y-2 animate-pulse">
      {[1,2,3,4,5].map((i) => <div key={i} className="h-14 rounded" style={{ backgroundColor: "var(--accent)" }} />)}
    </div>
  );
  if (attempts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--muted-foreground)" }}>
      <InboxIcon className="w-10 h-10 opacity-20" />
      <p className="text-sm font-medium">No questions attempted yet</p>
    </div>
  );
  const rows = attempts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto">
        <div className="w-[90%] mx-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "20%" }}>Date / Time</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "32%" }}>Topic</th>
                <th className="py-3 text-xs font-normal text-left" style={{ color: "var(--muted-foreground)", width: "14%" }}>Type</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "14%" }}>Score</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "10%" }}>Hints</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "10%" }}>Time</th>
                <th className="py-3 text-xs font-normal text-right" style={{ color: "var(--muted-foreground)", width: "4%" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const topic = moduleToTopic.get(a.moduleId);
                const pct = a.maxMarks > 0 ? a.awardedMarks / a.maxMarks : 0;
                const scoreColour = pct >= 0.7 ? "#16a34a" : pct >= 0.5 ? "#d97706" : "#dc2626";
                const scoreBg = pct >= 0.7 ? "#f0fdf4" : pct >= 0.5 ? "#fffbeb" : "#fef2f2";
                const { date, time } = tableDateParts(a.createdAt);
                return (
                  <>
                  <tr key={a.id} className="group cursor-pointer" style={{ borderBottom: expandedAttemptId === a.id ? "none" : "1px solid var(--border)" }} onClick={() => setExpandedAttemptId(prev => prev === a.id ? null : a.id)}>
                    <td className="py-4 group-hover:opacity-80 transition-opacity">
                      <p className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{date}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{time}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{topic?.title ?? "Unknown"}</p>
                      {topic?.groupTitle && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{topic.groupTitle}</p>}
                    </td>
                    <td className="py-4">
                      <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-md" style={{ backgroundColor: a.submissionType === "code" ? "#ecfdf5" : "#eff6ff", color: a.submissionType === "code" ? "#059669" : "#3b82f6" }}>
                        {a.submissionType === "code" ? "Coding" : "Theory"}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: scoreBg, color: scoreColour }}>
                        {a.awardedMarks}/{a.maxMarks}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm" style={{ color: "var(--muted-foreground)" }}>{a.hintsUsedCount || "—"}</td>
                    <td className="py-4 text-right text-sm font-mono" style={{ color: "var(--muted-foreground)" }}>
                      {a.timeSpentSeconds > 0 ? formatDuration(a.timeSpentSeconds) : "—"}
                    </td>
                    <td className="py-4 pl-2">
                      <ChevronDown
                        className="w-3.5 h-3.5 transition-transform"
                        style={{
                          color: "var(--muted-foreground)",
                          transform: expandedAttemptId === a.id ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </td>
                  </tr>
                  {expandedAttemptId === a.id && <AttemptDetailExpanded key={`detail-${a.id}`} attemptId={a.id} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} total={attempts.length} onPage={onPage} />
    </div>
  );
}

function SessionsList({ studentId }: { studentId?: string }) {
  const ownSessions = useListSessions({ enabled: !studentId });
  const studentSessions = useListStudentSessions(studentId);
  const { sessions, isLoading, isError } = studentId ? studentSessions : ownSessions;

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: "var(--accent)" }} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ color: "var(--muted-foreground)" }}>
        <p className="text-sm">Could not load sessions</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: "var(--muted-foreground)" }}>
        <Clock className="w-8 h-8 opacity-20" />
        <p className="text-sm font-medium">No sessions yet</p>
        <p className="text-xs">Sessions appear here after practice</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((s) => {
        const pct = s.summary.questionsAttempted > 0 ? s.summary.averageScore : null;
        const scoreColour = pct === null ? "" : pct >= 0.7 ? "text-emerald-600" : pct >= 0.5 ? "text-amber-600" : "text-rose-600";
        return (
          <div key={s.id} className="px-4 py-3 rounded-lg" style={{ backgroundColor: "var(--accent)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium capitalize px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                  {s.mode}
                </span>
                {s.durationSeconds !== undefined && (
                  <span className="flex items-center gap-1 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
                    <Clock className="w-3 h-3" />
                    {formatDuration(s.durationSeconds)}
                  </span>
                )}
              </div>
              <span className="text-xs opacity-50" style={{ color: "var(--muted-foreground)" }}>{formatDate(s.startedAt)}</span>
            </div>
            {s.summary.questionsAttempted > 0 && (
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.summary.questionsAttempted} question{s.summary.questionsAttempted !== 1 ? "s" : ""}</span>
                {pct !== null && <span className={`text-xs font-semibold ${scoreColour}`}>{Math.round(pct * 100)}% score</span>}
                {s.summary.hintsUsed > 0 && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}><Lightbulb className="w-3 h-3 text-amber-400" />{s.summary.hintsUsed} hints</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PreviousTab({ moduleIds }: { moduleIds: string[] }) {
  const { attempts, isLoading } = useListAttempts({ moduleIds: moduleIds.length > 0 ? moduleIds : undefined, limit: 30, enabled: true });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl" style={{ backgroundColor: "var(--accent)" }} />)}
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--muted-foreground)" }}>
        <InboxIcon className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">No attempts yet</p>
        <p className="text-xs">Try the Theory or Coding tabs to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {attempts.map((a, i) => (
        <div
          key={a.id}
          className="px-4 py-3 rounded-lg transition-colors"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Question {attempts.length - i}
            </span>
            <ScorePill awarded={a.awardedMarks} max={a.maxMarks} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <Lightbulb className="w-3 h-3 text-amber-400" />
              {a.hintsUsedCount > 0 ? `${a.hintsUsedCount} hint${a.hintsUsedCount === 1 ? "" : "s"}` : "No hints"}
            </span>
            <span className="text-xs opacity-50" style={{ color: "var(--muted-foreground)" }}>{formatDate(a.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttemptDetailRow({ attempt, studentId }: { attempt: AttemptItem; studentId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { attempt: detail, isLoading: detailLoading } = useGetAttemptDetail(expanded ? attempt.id : "", studentId);
  const typeBg = attempt.submissionType === "code" ? "#ecfdf5" : "#eff6ff";
  const typeColour = attempt.submissionType === "code" ? "#059669" : "#3b82f6";

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button
        className="w-full text-left px-4 py-3 transition-colors"
        style={{ backgroundColor: expanded ? "var(--accent)" : "transparent" }}
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0" style={{ backgroundColor: typeBg, color: typeColour }}>
              {attempt.submissionType === "code" ? "Coding" : "Theory"}
            </span>
            <ScorePill awarded={attempt.awardedMarks} max={attempt.maxMarks} />
            {attempt.hintsUsedCount > 0 && (
              <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                <Lightbulb className="w-3 h-3 text-amber-400" />
                {attempt.hintsUsedCount}
              </span>
            )}
          </div>
          <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>{formatDate(attempt.createdAt)}</span>
        </div>
        {attempt.feedback && (
          <p className="text-xs mt-1.5 line-clamp-2 text-left" style={{ color: "var(--muted-foreground)" }}>{attempt.feedback}</p>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 pt-4" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
          {/* Question + student answer — needs detail API */}
          {detailLoading ? (
            <div className="flex items-center gap-2 py-2" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading question…</span>
            </div>
          ) : detail ? (
            <>
              {detail.questionText && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>Question</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{detail.questionText}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>Student&apos;s answer</p>
                <div className="rounded-lg px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: attempt.submissionType === "code" ? "monospace" : "inherit" }}>
                  {detail.submittedAnswer || <span style={{ color: "var(--muted-foreground)" }}>No answer submitted</span>}
                </div>
              </div>
            </>
          ) : null}

          {/* Strengths — available from list data */}
          {attempt.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#16a34a" }}>What they got right</p>
              <ul className="space-y-1">
                {attempt.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                    <span className="shrink-0 mt-0.5" style={{ color: "#16a34a" }}>✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing points — available from list data */}
          {attempt.missingPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#dc2626" }}>Missing points</p>
              <ul className="space-y-1">
                {attempt.missingPoints.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                    <span className="shrink-0 mt-0.5" style={{ color: "#dc2626" }}>✗</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feedback — available from list data */}
          {attempt.feedback && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>Feedback</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{attempt.feedback}</p>
            </div>
          )}

          {/* Model answer — needs detail API */}
          {detail?.modelAnswer && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>Model answer</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{detail.modelAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentAttemptsList({ studentId }: { studentId: string }) {
  const { attempts, isLoading } = useListAttempts({ studentId, limit: 100, enabled: true });


  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: "var(--accent)" }} />)}
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ color: "var(--muted-foreground)" }}>
        <InboxIcon className="w-8 h-8 opacity-20" />
        <p className="text-sm font-medium">No questions attempted yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attempts.map((a) => <AttemptDetailRow key={a.id} attempt={a as AttemptItem} studentId={studentId} />)}
    </div>
  );
}

function StudentCard({ s, onDelete, deletesPending }: { s: { id: string; fullName: string; email: string; examBoardPreference?: string }; onDelete: () => void; deletesPending: boolean }) {
  const [view, setView] = useState<"sessions" | "attempts" | null>(null);
  const toggle = (tab: "sessions" | "attempts") => setView((v) => (v === tab ? null : tab));

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
          {getInitials(s.fullName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{s.fullName}</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.email} · {s.examBoardPreference ?? "OCR"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggle("sessions")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ color: "var(--muted-foreground)", backgroundColor: view === "sessions" ? "var(--accent)" : "transparent" }}
          >
            {view === "sessions" ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Sessions
          </button>
          <button
            onClick={() => toggle("attempts")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ color: "var(--muted-foreground)", backgroundColor: view === "attempts" ? "var(--accent)" : "transparent" }}
          >
            {view === "attempts" ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Questions
          </button>
          <button
            onClick={onDelete}
            disabled={deletesPending}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
            title="Delete student"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === "sessions" && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-2" style={{ color: "var(--muted-foreground)" }}>Recent sessions</p>
          <SessionsList studentId={s.id} />
        </div>
      )}

      {view === "attempts" && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-2" style={{ color: "var(--muted-foreground)" }}>Questions attempted</p>
          <StudentAttemptsList studentId={s.id} />
        </div>
      )}
    </div>
  );
}

function ParentDashboard() {
  const { students, isLoading } = useStudents();
  const createStudent = useCreateStudent();
  const deleteStudent = useDeleteStudent();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", examBoardPreference: "OCR" as ExamBoard });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      await createStudent.mutateAsync(form);
      setSuccess(`Student account created for ${form.fullName}. They can now log in with ${form.email}.`);
      setForm({ fullName: "", email: "", password: "", examBoardPreference: "OCR" });
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create student");
    }
  };

  const handleDelete = async (studentId: string, name: string) => {
    if (!confirm(`Delete ${name}'s account? This cannot be undone.`)) return;
    try {
      await deleteStudent.mutateAsync({ studentId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete student");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>Parent Dashboard</h1>
        <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>Manage your students</p>
      </div>

      {success && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">{success}</div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Students</h2>
          <button
            onClick={() => { setShowForm((v) => !v); setError(""); }}
            className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {showForm ? "Cancel" : "+ Add student"}
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl" style={{ backgroundColor: "var(--accent)" }} />)}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ border: "2px dashed var(--border)", color: "var(--muted-foreground)" }}>
            <p className="font-medium">No students yet</p>
            <p className="text-sm mt-1">Add your first student to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((s: { id: string; fullName: string; email: string; examBoardPreference?: string }) => (
              <StudentCard
                key={s.id}
                s={s}
                onDelete={() => handleDelete(s.id, s.fullName)}
                deletesPending={deleteStudent.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>New student account</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Full name</label>
              <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                required minLength={8} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Exam board</label>
              <select value={form.examBoardPreference} onChange={(e) => setForm({ ...form, examBoardPreference: e.target.value as ExamBoard })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              >
                <option value="OCR">OCR</option>
                <option value="AQA">AQA</option>
                <option value="Edexcel">Edexcel</option>
              </select>
            </div>
            {error && <p className="text-rose-600 text-sm bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={createStudent.isPending}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createStudent.isPending ? "Creating…" : "Create student account"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useMe();
  const examBoard = (user?.examBoardPreference as ExamBoard) ?? "Edexcel";
  const { topics, isLoading } = useGetCurriculum(examBoard);
  const { timeSpent, timerReady, totalAttempts } = usePracticeTimer();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "1": true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedTopic, setSelectedTopic] = useState<SelectedTopic | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("theory");
  const [practiceKey, setPracticeKey] = useState(0);
  const [rightPanelView, setRightPanelView] = useState<null | "sessions" | "attempts">(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [attemptsPage, setAttemptsPage] = useState(1);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [isAutoTopic, setIsAutoTopic] = useState(false);

  const { sessions: panelSessions, isLoading: panelSessionsLoading } = useListSessions({
    limit: 100,
    enabled: rightPanelView === "sessions",
  });
  const { attempts: panelAttempts, isLoading: panelAttemptsLoading } = useListAttempts({
    limit: 200,
    enabled: rightPanelView === "attempts",
  });

  const moduleToTopic = useMemo(() => {
    const map = new Map<string, { title: string; code: string; groupTitle: string }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topics.forEach((t: any) => {
      (t.moduleIds as string[]).forEach((mId: string) => {
        map.set(mId, { title: t.title as string, code: t.code as string, groupTitle: t.topicGroupTitle as string });
      });
    });
    return map;
  }, [topics]);

  const handleSelectTopic = (topic: SelectedTopic, sectionNum: string) => {
    if (selectedTopic?.code === topic.code) {
      setSelectedTopic(null);
      setIsAutoTopic(false);
      return;
    }
    setSelectedTopic(topic);
    setIsAutoTopic(false);
    setActiveTab("theory");
    setPracticeKey((k) => k + 1);
    setRightPanelView(null);
    setExpanded((prev) => ({ ...prev, [sectionNum]: true }));
    setExpandedGroups((prev) => ({ ...prev, [`${sectionNum}-${topic.groupTitle}`]: true }));
  };

  useEffect(() => {
    if (!hasAutoStarted && topics.length > 0 && !selectedTopic && rightPanelView === null) {
      const random = topics[Math.floor(Math.random() * topics.length)];
      const sectionNum = random.code.split(".")[0];
      handleSelectTopic(
        {
          title: random.title,
          code: random.code,
          moduleId: random.moduleIds[0],
          moduleIds: random.moduleIds,
          paper: random.paper as "01" | "02",
          groupTitle: random.topicGroupTitle,
        },
        sectionNum,
      );
      setHasAutoStarted(true);
      setIsAutoTopic(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, hasAutoStarted]);

  if (user?.role === "parent") {
    return <ParentDashboard />;
  }

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  const sectionNums = [...new Set(topics.map((t) => t.code.split(".")[0]))];
  const sections = sectionNums.map((num) => {
    const sectionTopics = topics.filter((t) => t.code.startsWith(`${num}.`));
    const groups = sectionTopics.reduce<Record<string, typeof topics>>((acc, t) => {
      if (!acc[t.topicGroupTitle]) acc[t.topicGroupTitle] = [];
      acc[t.topicGroupTitle].push(t);
      return acc;
    }, {});
    return { num, label: SECTION_LABELS[num] ?? `Topic ${num}`, groups: Object.entries(groups), isProgramming: num === "6" };
  });

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab !== "previous") setPracticeKey((k) => k + 1);
  };

  return (
    // Stretch to fill remaining viewport, cancel out the parent's padding
    <div className="flex -mx-4 -my-8" style={{ height: "calc(100vh - 3rem)" }}>

      {/* ── Left column: topic menu (standard sidebar width) ── */}
      <div
        className="w-72 shrink-0 overflow-y-auto no-scrollbar"
        style={{
          borderRight: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          boxShadow: "4px 0 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Greeting header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Hi {firstName} 👋</p>
            {user?.examBoardPreference && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide" style={{ backgroundColor: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                {user.examBoardPreference}
              </span>
            )}
          </div>
          {/* Stats cards */}
          <div className="flex flex-col gap-1">
            {/* Practice time */}
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              style={{
                backgroundColor: rightPanelView === "sessions" ? "#e0e7ff" : "#eef2ff",
                border: `1px solid ${rightPanelView === "sessions" ? "#a5b4fc" : "#c7d2fe"}`,
              }}
              onClick={() => {
                const next = rightPanelView === "sessions" ? null : "sessions" as const;
                setRightPanelView(next);
                if (next) { setSelectedTopic(null); setSessionsPage(1); }
              }}
            >
              <Clock className="w-3 h-3 shrink-0" style={{ color: rightPanelView === "sessions" ? "#3730a3" : "#4f46e5" }} />
              <p className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>Practice time</p>
              <p className="text-xs font-bold font-mono ml-auto" style={{ color: "var(--foreground)" }}>
                {timerReady ? (() => { const h = Math.floor(timeSpent / 3600); const m = Math.floor((timeSpent % 3600) / 60); const s = timeSpent % 60; return `${h}h:${m}m:${s}s`; })() : "0h:0m:0s"}
              </p>
            </div>
            {/* Questions */}
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              style={{
                backgroundColor: rightPanelView === "attempts" ? "#dcfce7" : "#f0fdf4",
                border: `1px solid ${rightPanelView === "attempts" ? "#86efac" : "#bbf7d0"}`,
              }}
              onClick={() => {
                const next = rightPanelView === "attempts" ? null : "attempts" as const;
                setRightPanelView(next);
                if (next) { setSelectedTopic(null); setAttemptsPage(1); }
              }}
            >
              <BookOpen className="w-3 h-3 shrink-0" style={{ color: rightPanelView === "attempts" ? "#15803d" : "#16a34a" }} />
              <p className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>Questions done</p>
              <p className="text-xs font-bold ml-auto" style={{ color: "var(--foreground)" }}>{totalAttempts}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-3 space-y-2 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-10 rounded-lg" style={{ backgroundColor: "var(--accent)" }} />)}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {sections.map(({ num, label, groups, isProgramming }) => {
              const isOpen = !!expanded[num];
              return (
                <div key={num} className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {/* Section header */}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={() => setExpanded((prev) => ({ ...prev, [num]: !prev[num] }))}
                  >
                    <p className="font-semibold text-sm flex-1 min-w-0 truncate" style={{ color: "var(--foreground)" }}>{label}</p>
                    <span className="font-medium px-1 rounded shrink-0 flex items-center" style={{ fontSize: "9px", height: "20px", backgroundColor: "var(--accent)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                      {isProgramming ? "Paper 02" : "Paper 01"}
                    </span>
                    {isProgramming
                      ? <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded" style={{ border: "1px solid #e9d5ff", backgroundColor: "#fdf4ff" }}><Code2 className="w-3 h-3" style={{ color: "#a855f7" }} /></span>
                      : <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded" style={{ border: "1px solid #bfdbfe", backgroundColor: "#eff6ff" }}><BookOpen className="w-3 h-3" style={{ color: "#3b82f6" }} /></span>
                    }
                  </button>

                  {/* Groups */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      {groups.map(([groupTitle, groupTopics]) => {
                        const groupKey = `${num}-${groupTitle}`;
                        const isGroupOpen = !!expandedGroups[groupKey];
                        return (
                          <div key={groupTitle}>
                            {/* Group header — collapsible */}
                            <button
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                              style={{ backgroundColor: "var(--muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                              onClick={() => toggleGroup(groupKey)}
                            >
                              <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{groupTitle}</p>
                            </button>

                            {/* Subtopics */}
                            {isGroupOpen && groupTopics.map((topic) => {
                              const isSelected = selectedTopic?.code === topic.code;
                              return (
                                <button
                                  key={topic.id}
                                  className="w-full text-left transition-colors"
                                  style={{
                                    padding: "6px 12px 6px 20px",
                                    backgroundColor: isSelected ? "var(--accent)" : "transparent",
                                    borderLeft: isSelected ? "2px solid #6366f1" : "2px solid transparent",
                                  }}
                                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
                                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                                  onClick={() => handleSelectTopic({
                                    title: topic.title,
                                    code: topic.code,
                                    moduleId: topic.moduleIds[0],
                                    moduleIds: topic.moduleIds,
                                    paper: topic.paper,
                                    groupTitle,
                                  }, num)}
                                >
                                  <p className="text-xs" style={{ color: "var(--foreground)", fontWeight: isSelected ? "500" : "400" }}>{topic.title}</p>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right column: content panel (60%) ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
        {rightPanelView !== null ? (
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                    {rightPanelView === "sessions" ? "Practice Sessions" : "Questions Attempted"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {rightPanelView === "sessions" ? "All your study sessions" : "All questions you have answered"}
                  </p>
                </div>
                <button
                  onClick={() => setRightPanelView(null)}
                  className="p-1 rounded-md transition-colors mt-0.5"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.color = "var(--foreground)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                {rightPanelView === "sessions" ? (
                  <SessionsPanel sessions={panelSessions as SessionItem[]} isLoading={panelSessionsLoading} page={sessionsPage} onPage={setSessionsPage} />
                ) : (
                  <AttemptsPanel attempts={panelAttempts as AttemptItem[]} isLoading={panelAttemptsLoading} page={attemptsPage} onPage={setAttemptsPage} moduleToTopic={moduleToTopic} />
                )}
              </div>
            </div>
          </div>
        ) : !selectedTopic ? (
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--accent)" }}>
                  <BookOpen className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
                </div>
                <p className="font-medium" style={{ color: "var(--foreground)" }}>Select a topic</p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Pick any topic from the left panel to start practising</p>
                <button
                  onClick={() => {
                    if (topics.length === 0) return;
                    const random = topics[Math.floor(Math.random() * topics.length)];
                    const sectionNum = random.code.split(".")[0];
                    handleSelectTopic(
                      {
                        title: random.title,
                        code: random.code,
                        moduleId: random.moduleIds[0],
                        moduleIds: random.moduleIds,
                        paper: random.paper as "01" | "02",
                        groupTitle: random.topicGroupTitle,
                      },
                      sectionNum,
                    );
                    setIsAutoTopic(true);
                  }}
                  className="mt-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e0e7ff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#eef2ff"; }}
                >
                  Get a random question
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-2 min-h-0">
            <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {/* Topic header with description */}
              <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>{selectedTopic.title}</h2>
                  {isAutoTopic && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: "#fdf4ff", color: "#a855f7", border: "1px solid #e9d5ff" }}>
                      Random
                    </span>
                  )}
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: "var(--accent)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                    Paper {selectedTopic.paper}
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: selectedTopic.paper === "02" ? "#fdf4ff" : "#eff6ff", color: selectedTopic.paper === "02" ? "#a855f7" : "#3b82f6", border: selectedTopic.paper === "02" ? "1px solid #e9d5ff" : "1px solid #bfdbfe" }}>
                    {selectedTopic.paper === "02" ? "Programming" : "Theory"}
                  </span>
                </div>
                {TOPIC_DESCRIPTIONS[selectedTopic.code] && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    {TOPIC_DESCRIPTIONS[selectedTopic.code]}
                  </p>
                )}
              </div>
              {/* Tabs */}
              <div className="flex px-5 pt-1 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                {(["theory", ...(selectedTopic.paper === "02" ? ["coding"] : []), "previous"] as ActiveTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors capitalize"
                    style={{
                      color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                      borderBottom: activeTab === tab ? "2px solid var(--foreground)" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                  >
                    {tab === "theory" && <BookOpen className="w-3.5 h-3.5" />}
                    {tab === "coding" && <Code2 className="w-3.5 h-3.5" />}
                    {tab === "previous" && <History className="w-3.5 h-3.5" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab content — scrollable */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
                {activeTab === "previous" ? (
                  <PreviousTab moduleIds={selectedTopic.moduleIds} />
                ) : (
                  selectedTopic.moduleId ? (
                    <PracticeSession
                      key={`${selectedTopic.moduleId}-${activeTab}-${practiceKey}`}
                      moduleId={selectedTopic.moduleId}
                      mode={activeTab as "theory" | "coding"}
                      onEnd={() => setSelectedTopic(null)}
                    />
                  ) : (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No module available for this topic.</p>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
