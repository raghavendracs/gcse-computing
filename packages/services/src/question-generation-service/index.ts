import Anthropic from "@anthropic-ai/sdk";
import { getSeedModel } from "../ai/model-map";
import {
  generateSeedQuestionInput,
  generatedSeedQuestion,
  type GenerateSeedQuestionInput,
  type GeneratedSeedQuestion,
} from "./models";

const SYSTEM_PROMPT = `You are a GCSE Python examiner creating a self-contained coding question.
Output ONLY a JSON object: { "questionText", "starterCode"?, "testCases": [{ "input", "expectedOutput", "hidden", "description" }], "hints": [3 strings], "modelAnswer" }.
Rules:
- The program reads all input from standard input (input()) and writes the answer to standard output (print()).
- Each testCase.input is fed to stdin; testCase.expectedOutput is compared against stdout (trailing newline ignored).
- Provide at least 4 test cases: normal cases AND boundary/edge cases; mark at least one { "hidden": true }; give every case a short "description".
- questionType "write": no starterCode. "fix"/"extend": include starterCode the student edits.
- Exactly 3 progressively-revealing hints; never include the full solution in a hint.
- modelAnswer: complete, correct Python 3 that passes every test case.
- easy = sequence/simple selection; medium = iteration/lists/functions; hard = nested loops/2D lists/multiple functions.`;

export interface SeedUsage {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

class QuestionGenerationService {
  private client: Anthropic;
  private usage: SeedUsage = { inputTokens: 0, outputTokens: 0, calls: 0 };

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /** Cumulative Anthropic token usage across all generateSeedQuestion calls (incl. discarded ones). */
  getUsage(): SeedUsage {
    return { ...this.usage };
  }

  async generateSeedQuestion(input: GenerateSeedQuestionInput): Promise<GeneratedSeedQuestion> {
    const data = await generateSeedQuestionInput.parseAsync(input);
    const userPrompt = `Topic: "${data.topicName}" — ${data.topicDescription}
Difficulty: ${data.difficulty}
Question type: ${data.questionType}
Return ONLY the JSON object.`;

    const message = await this.client.messages.create({
      model: getSeedModel(),
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    this.usage.inputTokens += message.usage?.input_tokens ?? 0;
    this.usage.outputTokens += message.usage?.output_tokens ?? 0;
    this.usage.calls += 1;

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response type");
    const fence = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fence ? fence[1].trim() : content.text.trim();
    return generatedSeedQuestion.parse(JSON.parse(jsonStr));
  }
}

export default QuestionGenerationService;
