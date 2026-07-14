import "dotenv/config";
import { connectToDatabase, disconnectFromDatabase } from "@gcse/database";
import { runSeedIfEmpty } from "./index.js";

async function main() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/gcse";
  await connectToDatabase(mongoUri);
  await runSeedIfEmpty();
  await disconnectFromDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
