import { router } from "./trpc";
import { authRouter } from "./routes/auth/route";
import { topicsRouter } from "./routes/topics/route";
import { questionsRouter } from "./routes/questions/route";
import { leaderboardRouter } from "./routes/leaderboard/route";
import { sessionsRouter } from "./routes/sessions/route";
import { historyRouter } from "./routes/history/route";

export const appRouter = router({
  auth: authRouter,
  topics: topicsRouter,
  questions: questionsRouter,
  leaderboard: leaderboardRouter,
  sessions: sessionsRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, authenticatedProcedure } from "./trpc";
export { createContext } from "./context";
export type { Context, JWTPayload, TRPCContext } from "./context";
