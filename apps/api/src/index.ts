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

async function main() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/gcse";
  await connectToDatabase(mongoUri);
  await runSeedIfEmpty();
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
