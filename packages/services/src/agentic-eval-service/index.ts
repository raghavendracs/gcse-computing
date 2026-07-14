import Anthropic from "@anthropic-ai/sdk";
import { Question } from "@gcse/database";
import { Types } from "mongoose";
import CodeExecutionService from "../code-execution-service";
import { getEvalModel } from "../ai/model-map";
import { gapAnalysisOutput, type EvalCase, type EvalCaseResult, type GapAnalysis } from "./models";

const GEN_SYSTEM = `You are a GCSE Computer Science examiner creating test inputs for a Python programming question.
Return ONLY a JSON array of 6 to 8 objects, each: {"input": "<stdin>", "kind": "normal"|"edge"}.
- "input" is exactly what the program reads from stdin, with lines separated by \\n, matching the question's stated input format.
- Include a spread of "normal" cases and "edge" cases (empty/zero/negative/large/duplicate/boundary/ordering) that a GCSE student should handle.
- Stay strictly within GCSE level. Do not include inputs that require above-level constructs.
Output the JSON array and nothing else.`;

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

  async gradeSubmission(input: { questionId: string; code: string }): Promise<{ results: EvalCaseResult[]; matched: number; total: number }> {
    const cases = await this.ensureEvalCases(input.questionId);
    if (cases.length === 0) return { results: [], matched: 0, total: 0 };

    const run = await this.exec.execute({
      code: input.code,
      testCases: cases.map((c) => ({ input: c.input, expectedOutput: c.referenceOutput, hidden: c.hidden })),
      timeoutMs: 5000,
    });

    const results: EvalCaseResult[] = run.testResults.map((r, i) => ({
      input: cases[i].input,
      referenceOutput: cases[i].referenceOutput,
      studentOutput: r.actualOutput ?? "",
      matched: r.passed,
      kind: cases[i].kind,
      hidden: cases[i].hidden,
    }));
    return { results, matched: results.filter((r) => r.matched).length, total: results.length };
  }

  // Logical gap analysis: compare the student's code to the reference answer and
  // the question requirements, grounded on concrete divergences. Best-effort —
  // any failure degrades to a graceful empty analysis (never throws).
  async analyze(input: {
    questionText: string;
    submittedCode: string;
    modelAnswer: string;
    divergences: { input: string; referenceOutput: string; studentOutput: string }[];
    revealAnswer: boolean;
  }): Promise<GapAnalysis> {
    const fallback: GapAnalysis = {
      summary: "Automated analysis unavailable.",
      matched: [],
      gaps: [],
      likelyComplete: null,
    };

    try {
      const leakRule = input.revealAnswer
        ? "The student has used all their attempts, so you may reference the intended approach."
        : "Do NOT reveal the reference solution or write a corrected program. Describe what is missing and why it matters, not the fix.";

      const system = `You are a GCSE Computer Science examiner comparing a student's Python code against a reference solution and the question requirements.
Judge strictly at GCSE level (input/print, if/elif/else, for/while, lists, strings, functions, basic file I/O). Never suggest above-level constructs (required comprehensions, OOP, recursion, advanced stdlib).
${leakRule}
Return ONLY a JSON object with exactly these fields:
{
  "summary": "1-2 short, plain, encouraging sentences",
  "matched": ["a requirement the student clearly met", ...],
  "gaps": [{"title": "short label", "detail": "what is missing and why it matters", "severity": "logic"|"edge_case"|"requirement"|"style"}],
  "likelyComplete": true or false
}`;

      const divText = input.divergences.length
        ? input.divergences
            .map(
              (d, i) =>
                `Case ${i + 1}: input=${JSON.stringify(d.input)} expected=${JSON.stringify(d.referenceOutput)} student=${JSON.stringify(d.studentOutput)}`,
            )
            .join("\n")
        : "The student's output matched the reference on every checked input.";

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

Concrete divergences from the reference:
${divText}`;

      const msg = await this.client.messages.create({
        model: getEvalModel(),
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: user }],
      });

      const content = msg.content[0];
      if (content.type !== "text") return fallback;
      const fence = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = fence ? fence[1].trim() : content.text.trim();
      return gapAnalysisOutput.parse(JSON.parse(raw));
    } catch {
      return fallback;
    }
  }
}

export default AgenticEvalService;
