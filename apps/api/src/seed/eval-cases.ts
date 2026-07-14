import "dotenv/config";
import { connectToDatabase, disconnectFromDatabase, Question } from "@gcse/database";
import { AgenticEvalService } from "@gcse/services";

// Warm the AI-generated eval cases for every question that doesn't have them yet,
// so the first student to attempt a question never pays the generation latency.
// Requires ANTHROPIC_API_KEY and a reachable PYTHON_SANDBOX_URL.
//
// Optional env knobs:
//   SEED_LIMIT      — only process the first N questions missing eval cases
//   SEED_ONLY_SLUG  — only questions whose topic slug matches (best-effort; skipped if unsupported)
async function main() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/gcse";
  await connectToDatabase(mongoUri);

  const limit = process.env.SEED_LIMIT ? parseInt(process.env.SEED_LIMIT, 10) : undefined;

  const query: Record<string, unknown> = {
    deletedAt: null,
    $or: [{ evalCases: { $exists: false } }, { evalCases: { $size: 0 } }],
  };

  let cursor = Question.find(query, { _id: 1 }).sort({ _id: 1 });
  if (limit && limit > 0) cursor = cursor.limit(limit);
  const questions = await cursor;

  console.log(`Found ${questions.length} question(s) needing eval cases.`);

  const svc = new AgenticEvalService();
  let warmed = 0;
  let empty = 0;

  for (let i = 0; i < questions.length; i++) {
    const id = questions[i]._id.toString();
    try {
      const cases = await svc.ensureEvalCases(id);
      if (cases.length > 0) {
        warmed++;
        console.log(`[${i + 1}/${questions.length}] ${id} → ${cases.length} eval cases`);
      } else {
        empty++;
        console.warn(`[${i + 1}/${questions.length}] ${id} → 0 eval cases (generation/oracle produced nothing)`);
      }
    } catch (err) {
      console.error(`[${i + 1}/${questions.length}] ${id} → error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Done. Warmed ${warmed} question(s); ${empty} produced no cases.`);
  await disconnectFromDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Eval-case backfill failed:", err);
    process.exit(1);
  });
