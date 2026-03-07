import { router } from "./trpc";
import { authRouter } from "./routes/auth/route";
import { modulesRouter } from "./routes/modules/route";
import { questionsRouter } from "./routes/questions/route";
import { sessionsRouter } from "./routes/sessions/route";
import { historyRouter } from "./routes/history/route";

export const appRouter = router({
  auth: authRouter,
  modules: modulesRouter,
  questions: questionsRouter,
  sessions: sessionsRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, authenticatedProcedure, parentOnlyProcedure, studentProcedure } from "./trpc";
export { createContext } from "./context";
export type { Context, JWTPayload, TRPCContext } from "./context";
