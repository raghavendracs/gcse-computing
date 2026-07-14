import "dotenv/config";
import { connectToDatabase, disconnectFromDatabase, ProgrammingTopic, Question } from "@gcse/database";
import { QuestionGenerationService, CodeExecutionService, DIFFICULTY_POINTS } from "@gcse/services";

const genSvc = new QuestionGenerationService();
const execSvc = new CodeExecutionService();

const PER_TOPIC = Number(process.env.QUESTIONS_PER_TOPIC ?? 50);
const SPLIT: Record<"easy" | "medium" | "hard", number> = { easy: 20, medium: 20, hard: 10 };
const TYPES = ["write", "write", "fix", "extend"] as const; // bias toward write-from-scratch

function scaledSplit(total: number) {
  const factor = total / 50;
  return {
    easy: Math.round(SPLIT.easy * factor),
    medium: Math.round(SPLIT.medium * factor),
    hard: Math.round(SPLIT.hard * factor),
  };
}

async function verify(
  modelAnswer: string,
  testCases: Array<{ input: string; expectedOutput: string; hidden: boolean; description?: string }>,
): Promise<boolean> {
  const res = await execSvc.execute({ code: modelAnswer, testCases, timeoutMs: 5000 });
  return res.executionPath === "sandbox" && res.testResults.every((r) => r.passed);
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || "mongodb://localhost:27017/gcse";
  await connectToDatabase(mongoUri);

  const onlySlug = process.env.SEED_ONLY_SLUG;
  const onlyArea = process.env.SEED_ONLY_AREA;
  const limit = process.env.SEED_LIMIT ? Number(process.env.SEED_LIMIT) : Infinity;
  const topicFilter = onlySlug
    ? { slug: onlySlug }
    : onlyArea
      ? { area: onlyArea, deletedAt: null }
      : { deletedAt: null };
  const topics = await ProgrammingTopic.find(topicFilter).sort({ areaSortOrder: 1, sortOrder: 1 });
  let inserted = 0;
  let discarded = 0;

  for (const topic of topics) {
    const target = scaledSplit(PER_TOPIC);
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const have = await Question.countDocuments({ topicId: topic._id, difficulty, deletedAt: null });
      let need = Math.max(0, target[difficulty] - have);
      let typeIdx = 0;
      while (need > 0 && inserted < limit) {
        const questionType = TYPES[typeIdx++ % TYPES.length];
        try {
          const q = await genSvc.generateSeedQuestion({
            topicName: topic.name,
            topicDescription: topic.description,
            difficulty,
            questionType,
          });
          const ok = await verify(q.modelAnswer, q.testCases);
          if (!ok) {
            discarded++;
            console.warn(`  ✗ discarded (model answer failed tests) ${topic.slug}/${difficulty}`);
            continue;
          }
          await Question.insertOne({
            topicId: topic._id,
            difficulty,
            questionType,
            questionText: q.questionText,
            starterCode: q.starterCode,
            testCases: q.testCases,
            points: DIFFICULTY_POINTS[difficulty],
            hints: q.hints,
            modelAnswer: q.modelAnswer,
          });
          inserted++;
          need--;
          console.log(`  ✓ ${topic.slug} ${difficulty} (${inserted} total)`);
        } catch (e) {
          console.warn(`  ! generation error ${topic.slug}/${difficulty}:`, (e as Error).message);
        }
      }
    }
  }

  // Token cost report — SEED model is Claude Sonnet 4.6: $3.00 / 1M input, $15.00 / 1M output.
  const u = genSvc.getUsage();
  const INPUT_PER_M = 3.0;
  const OUTPUT_PER_M = 15.0;
  const inputCost = (u.inputTokens / 1_000_000) * INPUT_PER_M;
  const outputCost = (u.outputTokens / 1_000_000) * OUTPUT_PER_M;
  const totalCost = inputCost + outputCost;

  console.log(`\nDone. Inserted ${inserted} questions (${discarded} discarded by the verify gate).`);
  console.log("─── Token usage (Claude Sonnet 4.6) ───");
  console.log(`  generation calls : ${u.calls}`);
  console.log(`  input tokens     : ${u.inputTokens.toLocaleString()}  ($${inputCost.toFixed(4)} @ $${INPUT_PER_M}/1M)`);
  console.log(`  output tokens    : ${u.outputTokens.toLocaleString()}  ($${outputCost.toFixed(4)} @ $${OUTPUT_PER_M}/1M)`);
  console.log(`  TOTAL COST       : $${totalCost.toFixed(4)}`);
  if (inserted > 0) {
    console.log(`  cost / inserted  : $${(totalCost / inserted).toFixed(4)} per question`);
  }

  await disconnectFromDatabase();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
