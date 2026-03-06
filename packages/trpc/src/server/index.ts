import { router } from "./trpc";
import { authRouter } from "./routes/auth/route";
import { modulesRouter } from "./routes/modules/route";

export const appRouter = router({
  auth: authRouter,
  modules: modulesRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, authenticatedProcedure, parentOnlyProcedure, studentProcedure } from "./trpc";
export { createContext } from "./context";
export type { Context, JWTPayload, TRPCContext } from "./context";
