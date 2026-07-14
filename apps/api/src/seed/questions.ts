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
  const limit = process.env.SEED_LIMIT ? Number(process.env.SEED_LIMIT) : Infinity;
  const topics = await ProgrammingTopic.find(onlySlug ? { slug: onlySlug } : { deletedAt: null });
  let inserted = 0;

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

  console.log(`Done. Inserted ${inserted} questions.`);
  await disconnectFromDatabase();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
