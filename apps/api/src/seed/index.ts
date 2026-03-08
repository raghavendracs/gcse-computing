import { Module, QuestionTemplate, SpecTopic, seedEdexcelSpec, seedEdexcelModules } from "@gcse/database";
import { seedModules } from "./modules.js";
import { seedTemplates } from "./templates.js";

export async function runSeedIfEmpty(): Promise<void> {
  const count = await Module.countDocuments();
  if (count > 0) {
    console.log(`Seed already applied (${count} modules found) — skipping`);

    // Spec topics may have been added after initial seed — check and fill
    const specCount = await SpecTopic.countDocuments();
    if (specCount === 0) {
      console.log("Seeding Edexcel spec topics...");
      await seedEdexcelSpec();
      await seedEdexcelModules();
    }

    return;
  }

  console.log("Running seed...");

  const inserted = await Module.insertMany(seedModules);
  console.log(`Seeded ${inserted.length} modules`);

  const moduleMap = new Map(inserted.map((m) => [m.moduleCode, m._id]));

  const templatesToInsert = seedTemplates
    .map((t) => {
      const moduleId = moduleMap.get(t.moduleCode);
      if (!moduleId) {
        console.warn(`Module not found for code: ${t.moduleCode}`);
        return null;
      }
      const { moduleCode: _ignored, ...rest } = t;
      return { ...rest, moduleId };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  await QuestionTemplate.insertMany(templatesToInsert);
  console.log(`Seeded ${templatesToInsert.length} question templates`);

  await seedEdexcelSpec();
  await seedEdexcelModules();
  console.log("Seeded Edexcel spec topics");
}
