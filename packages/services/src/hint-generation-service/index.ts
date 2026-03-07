import Anthropic from "@anthropic-ai/sdk";
import { type GenerateHintInput, type GenerateHintOutput, generateHintInput } from "./models";

const HINT_LEVEL_DESCRIPTIONS = [
  "very general — point toward the concept without mentioning the code structure",
  "slightly more specific — hint at the approach or algorithm",
  "more direct — describe the structure needed without giving code",
  "concrete — describe pseudocode or the key operation needed",
  "near-solution — provide structural scaffolding (pseudocode or partial structure). NEVER give the full working code answer.",
];

class HintGenerationService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateHint(input: GenerateHintInput): Promise<GenerateHintOutput> {
    const validated = await generateHintInput.parseAsync(input);
    const { questionText, submittedCode, hintLevel, testResults, modelId } = validated;

    const levelDesc = HINT_LEVEL_DESCRIPTIONS[hintLevel - 1];

    const testContext =
      testResults && testResults.length > 0
        ? `\nTest results from their last run:\n${testResults
            .map(
              (r, i) =>
                `  Test ${i + 1}: ${r.passed ? "PASS" : "FAIL"} (got "${r.actualOutput}", expected "${r.expectedOutput}")`,
            )
            .join("\n")}`
        : "";

    const systemPrompt = `You are a supportive GCSE Computer Science tutor giving a coding hint.
Generate a single hint that is ${levelDesc}.
Output ONLY the hint text — no labels, no "Hint:", no markdown formatting, no explanation.
The hint must be 1-2 sentences maximum.`;

    const userPrompt = `Question: ${questionText}

Student's current code:
\`\`\`python
${submittedCode || "(no code written yet)"}
\`\`\`
${testContext}

Generate hint ${hintLevel} of 5.`;

    const message = await this.client.messages.create({
      model: modelId,
      max_tokens: 150,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");

    return {
      hintText: content.text.trim(),
      hintLevel,
      isLastHint: hintLevel === 5,
    };
  }
}

export default HintGenerationService;
