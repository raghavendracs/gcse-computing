import Anthropic from "@anthropic-ai/sdk";
import { type AssessCodeInput, type AssessCodeOutput, assessCodeOutput } from "./models";

class CodingAssessmentService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async assessCode(input: AssessCodeInput): Promise<AssessCodeOutput> {
    const { questionText, submittedCode, testResults, markSchemePoints, maxMarks, modelId } = input;

    const testSummary =
      testResults.length > 0
        ? testResults
            .map(
              (r, i) =>
                `Test ${i + 1}: input="${r.input}" expected="${r.expectedOutput}" got="${r.actualOutput}" — ${r.passed ? "PASS" : "FAIL"}`,
            )
            .join("\n")
        : "No test results available.";

    const systemPrompt = `You are a GCSE Computer Science examiner marking student Python code.
Output ONLY a JSON object with exactly these fields:
{
  "awardedMarks": 4,
  "feedback": "2-3 sentences of constructive feedback",
  "missingPoints": ["mark scheme point the student missed"],
  "strengths": ["what the student got right"],
  "confidence": 0.9,
  "syntaxValid": true,
  "errorCategory": null
}
Rules:
- awardedMarks: integer 0..${maxMarks}
- errorCategory: "syntax" | "logic" | "runtime" | null
- syntaxValid: true if code has no syntax errors
- confidence: 0.0..1.0`;

    const userPrompt = `Question: ${questionText}

Mark scheme (${maxMarks} marks):
${markSchemePoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Student code:
\`\`\`python
${submittedCode}
\`\`\`

Test execution results:
${testSummary}`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 600,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : content.text.trim();
    const parsed = JSON.parse(jsonStr);

    if (
      typeof parsed.awardedMarks !== "number" ||
      typeof parsed.feedback !== "string" ||
      !Array.isArray(parsed.missingPoints) ||
      !Array.isArray(parsed.strengths) ||
      typeof parsed.confidence !== "number"
    ) {
      throw new Error("Invalid coding assessment response from AI");
    }

    return assessCodeOutput.parse({
      awardedMarks: Math.max(0, Math.min(maxMarks, Math.round(parsed.awardedMarks))),
      feedback: parsed.feedback,
      missingPoints: parsed.missingPoints,
      strengths: parsed.strengths,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.8)),
      syntaxValid: Boolean(parsed.syntaxValid),
      errorCategory: (["syntax", "logic", "runtime"].includes(parsed.errorCategory)
        ? parsed.errorCategory
        : null) as "syntax" | "logic" | "runtime" | null,
    });
  }
}

export default CodingAssessmentService;
