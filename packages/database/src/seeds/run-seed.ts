import { connectToDatabase, disconnectFromDatabase } from "../connection";
import { seedEdexcelSpec, seedEdexcelModules } from "./edexcel-spec";

async function main() {
  await connectToDatabase(process.env.MONGODB_URI!);
  await seedEdexcelSpec();
  await seedEdexcelModules();
  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
