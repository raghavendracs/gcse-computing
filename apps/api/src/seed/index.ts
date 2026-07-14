import { ProgrammingTopic } from "@gcse/database";
import { seedTopics } from "./topics.js";

export async function runSeedIfEmpty(): Promise<void> {
  console.log("Upserting programming taxonomy seed...");

  for (const t of seedTopics) {
    await ProgrammingTopic.updateOne(
      { slug: t.slug },
      { $set: t, $setOnInsert: { deletedAt: null } },
      { upsert: true },
    );
  }

  const count = await ProgrammingTopic.countDocuments();
  console.log(`Seed complete — ${count} programming topics in database`);
}
