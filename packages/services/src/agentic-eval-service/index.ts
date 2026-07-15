import Anthropic from "@anthropic-ai/sdk";
import { Question } from "@gcse/database";
import { Types } from "mongoose";
import CodeExecutionService from "../code-execution-service";
import { getEvalModel } from "../ai/model-map";
import { judgeOutput, type EvalCase, type EvalCaseResult, type EvaluateResult, type GapAnalysis } from "./models";

const GEN_SYSTEM = `You are a GCSE Computer Science examiner creating test inputs for a Python programming question.
Return ONLY a JSON array of 6 to 8 objects, each: {"input": "<stdin>", "kind": "normal"|"edge"}.
- "input" is exactly what the program reads from stdin, with lines separated by \\n, matching the question's stated input format.
- Include a spread of "normal" cases and "edge" cases (empty/zero/negative/large/duplicate/boundary/ordering) that a GCSE student should handle.
- Stay strictly within GCSE level. Do not include inputs that require above-level constructs.
Output the JSON array and nothing else.`;

// The grader's rulebook: judge LOGIC AND FLOW only, tolerate everything cosmetic.
const JUDGE_SYSTEM = `You are a GCSE Computer Science examiner marking a student's Python solution.
Mark ONLY the coding LOGIC and FLOW: does the program use a correct approach and compute the correct essential answer/values?

NEVER penalise, and never raise as a gap, any of these — they do not matter:
- input() prompt text (e.g. input("Enter a number") vs input())
- variable names
- extra or surrounding text in printed output (e.g. "Total: 42" vs "42")
- whitespace, blank lines, capitalisation, or output formatting
- the order in which explanatory labels appear

If the underlying logic correctly solves the problem, set "correct": true, "correctnessScore": 1.0 and return an EMPTY "gaps" array — even if the output text or formatting differs from the reference.
Only report a gap when there is a genuine LOGIC/FLOW/CORRECTNESS error: a wrong algorithm, an incorrect computation, or a missing case that changes the actual answer. Gap "severity" must be one of "logic", "edge_case", "requirement".
Judge strictly at GCSE level; never suggest above-level constructs (required comprehensions, OOP, recursion, advanced stdlib). Do not write a full corrected program.

Return ONLY a JSON object:
{
  "correct": true or false,
  "correctnessScore": 0.0 to 1.0,
  "summary": "1-2 short, plain, encouraging sentences",
  "strengths": ["what the logic gets right", ...],
  "gaps": [{"title": "short label", "detail": "what is logically wrong or missing and why it matters", "severity": "logic"|"edge_case"|"requirement"}],
  "likelyComplete": true or false
}`;

const norm = (s: string) => (s ?? "").trim();

class AgenticEvalService {
  private client: Anthropic;
  private exec: CodeExecutionService;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.exec = new CodeExecutionService();
  }

  async ensureEvalCases(questionId: string): Promise<EvalCase[]> {
    const q = await Question.findOne({ _id: new Types.ObjectId(questionId), deletedAt: null });
    if (!q) throw new Error("question not found");
    if (q.evalCases && q.evalCases.length > 0) return q.evalCases as EvalCase[];

    const inputs = await this.generateInputs(q.questionText);
    if (inputs.length === 0) return [];

    const run = await this.exec.execute({
      code: q.modelAnswer,
      testCases: inputs.map((i) => ({ input: i.input, expectedOutput: "", hidden: false })),
      timeoutMs: 5000,
    });

    const cases: EvalCase[] = [];
    run.testResults.forEach((r, idx) => {
      const ref = (r.actualOutput ?? "").trim();
      if (!ref) return; // drop inputs the oracle can't handle cleanly
      cases.push({
        input: inputs[idx].input,
        referenceOutput: ref,
        kind: inputs[idx].kind,
        hidden: inputs[idx].kind === "edge",
      });
    });

    if (cases.length > 0) {
      await Question.updateOne({ _id: q._id }, { $set: { evalCases: cases } });
    }
    return cases;
  }

  private async generateInputs(questionText: string): Promise<{ input: string; kind: "normal" | "edge" }[]> {
    try {
      const msg = await this.client.messages.create({
        model: getEvalModel(),
        max_tokens: 800,
        system: GEN_SYSTEM,
        messages: [{ role: "user", content: `Question:\n${questionText}` }],
      });
      const content = msg.content[0];
      if (content.type !== "text") return [];
      const fence = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = fence ? fence[1].trim() : content.text.trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x: any) => typeof x?.input === "string")
        .map((x: any) => ({ input: x.input, kind: x.kind === "edge" ? "edge" : "normal" }));
    } catch {
      return [];
    }
  }

  // Grade a submission by LOGIC. Execution (against cached eval cases) is gathered
  // as supporting evidence; the LLM judge makes the final correctness call,
  // tolerating cosmetic differences. Works even when no eval cases exist.
  async evaluate(input: {
    questionId: string;
    questionText: string;
    submittedCode: string;
    modelAnswer: string;
  }): Promise<EvaluateResult> {
    // 1. Gather execution evidence (best-effort).
    let results: EvalCaseResult[] = [];
    try {
      const cases = await this.ensureEvalCases(input.questionId);
      if (cases.length > 0) {
        const run = await this.exec.execute({
          code: input.submittedCode,
          testCases: cases.map((c) => ({ input: c.input, expectedOutput: c.referenceOutput, hidden: c.hidden })),
          timeoutMs: 5000,
        });
        results = run.testResults.map((r, i) => ({
          input: cases[i].input,
          referenceOutput: cases[i].referenceOutput,
          studentOutput: r.actualOutput ?? "",
          matched: norm(r.actualOutput ?? "") === norm(cases[i].referenceOutput),
          kind: cases[i].kind,
          hidden: cases[i].hidden,
        }));
      }
    } catch {
      results = [];
    }

    // 2. The judge decides correctness on logic/flow (tolerant of formatting).
    const verdict = await this.judge({
      questionText: input.questionText,
      submittedCode: input.submittedCode,
      modelAnswer: input.modelAnswer,
      results,
    });

    return {
      correct: verdict.correct,
      correctnessScore: verdict.correctnessScore,
      results,
      analysis: {
        summary: verdict.summary,
        matched: verdict.strengths,
        gaps: verdict.gaps,
        likelyComplete: verdict.likelyComplete,
      },
    };
  }

  private async judge(input: {
    questionText: string;
    submittedCode: string;
    modelAnswer: string;
    results: EvalCaseResult[];
  }): Promise<{ correct: boolean; correctnessScore: number; summary: string; strengths: string[]; gaps: GapAnalysis["gaps"]; likelyComplete: boolean | null }> {
    // Deterministic fallback if the LLM call/parse fails: fall back to execution
    // evidence (exact match) so grading still works, just less tolerant.
    const evidencePass = input.results.length > 0 ? input.results.every((r) => r.matched) : false;
    const evidenceScore =
      input.results.length > 0 ? input.results.filter((r) => r.matched).length / input.results.length : 0;
    const fallback = {
      correct: evidencePass,
      correctnessScore: evidenceScore,
      summary: "Automated analysis unavailable.",
      strengths: [],
      gaps: [] as GapAnalysis["gaps"],
      likelyComplete: null,
    };

    try {
      const evidence = input.results.length
        ? input.results
            .map(
              (r, i) =>
                `Case ${i + 1}: input=${JSON.stringify(r.input)} referenceOutput=${JSON.stringify(r.referenceOutput)} studentOutput=${JSON.stringify(r.studentOutput)}`,
            )
            .join("\n")
        : "No execution evidence is available — judge the code by reading it against the reference solution and the requirements.";

      const user = `Question:
${input.questionText}

Student code:
\`\`\`python
${input.submittedCode}
\`\`\`

Reference solution (for your comparison only — do not quote it back):
\`\`\`python
${input.modelAnswer}
\`\`\`

Execution evidence (studentOutput may differ cosmetically from referenceOutput — that is fine):
${evidence}`;

      const msg = await this.client.messages.create({
        model: getEvalModel(),
        max_tokens: 900,
        system: JUDGE_SYSTEM,
        messages: [{ role: "user", content: user }],
      });
      const content = msg.content[0];
      if (content.type !== "text") return fallback;
      const fence = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = fence ? fence[1].trim() : content.text.trim();
      const parsed = judgeOutput.parse(JSON.parse(raw));

      const correctnessScore = Math.max(0, Math.min(1, parsed.correctnessScore));
      return {
        correct: parsed.correct,
        correctnessScore: parsed.correct ? 1 : correctnessScore,
        summary: parsed.summary,
        strengths: parsed.strengths,
        gaps: parsed.gaps, // schema already excludes "style"
        likelyComplete: parsed.likelyComplete,
      };
    } catch {
      return fallback;
    }
  }
}

export default AgenticEvalService;
