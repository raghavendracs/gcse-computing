import Anthropic from "@anthropic-ai/sdk";
import { getModelId } from "../ai/model-map";
import { type MarkAnswerInput, type MarkAnswerOutput } from "./models";

class TheoryMarkingService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async markAnswer(input: MarkAnswerInput): Promise<MarkAnswerOutput> {
    const systemPrompt = `You are a fair GCSE Computer Science examiner. Mark student answers strictly but fairly.
Output ONLY a JSON object with exactly these fields:
{
  "awardedMarks": 3,
  "feedback": "2-3 sentences of constructive, exam-technique focused feedback",
  "missingPoints": ["mark scheme concept the student missed"],
  "strengths": ["what the student got right"],
  "confidence": 0.9
}
Rules:
- awardedMarks must be an integer between 0 and maxMarks (inclusive)
- confidence is a float 0.0–1.0 indicating your marking certainty
- missingPoints lists mark scheme concepts not addressed by the student
- strengths lists what the student got right
- feedback is 2-3 sentences, constructive and exam-technique focused`;

    const userPrompt = `Question: ${input.questionText}

Mark scheme (${input.maxMarks} marks total):
${input.markSchemePoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Student answer: ${input.submittedAnswer}`;

    const message = await this.client.messages.create({
      model: getModelId("budget"),
      max_tokens: 512,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    // Extract JSON from response, handling optional markdown code fences and any prefix text
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
      throw new Error("Invalid marking response from AI");
    }

    return {
      awardedMarks: Math.max(0, Math.min(input.maxMarks, Math.round(parsed.awardedMarks))),
      feedback: parsed.feedback,
      missingPoints: parsed.missingPoints as string[],
      strengths: parsed.strengths as string[],
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
    };
  }
}

export default TheoryMarkingService;
