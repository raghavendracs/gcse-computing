import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { connectToDatabase } from "@gcse/database";
import { appRouter } from "@gcse/trpc/server";
import { createContext } from "@gcse/trpc/server";
import { runSeedIfEmpty } from "./seed/index.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.WEB_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function connectWithRetry(mongoUri: string, retries = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await connectToDatabase(mongoUri);
      await runSeedIfEmpty();
      return;
    } catch (err) {
      console.error(`DB connect attempt ${attempt}/${retries} failed:`, err);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/gcse";

  // Start HTTP server immediately so /health responds during DB connect
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });

  // Connect to DB in the background with retries
  connectWithRetry(mongoUri).catch((err) => {
    console.error("Failed to connect to database after retries:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
