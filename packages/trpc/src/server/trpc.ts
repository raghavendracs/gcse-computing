import { initTRPC, TRPCError } from "@trpc/server";
import type { Context, JWTPayload } from "./context";
import { ZodError } from "zod";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Authenticated procedure — verifies a JWT is present
export const authenticatedProcedure = t.procedure.use(
  ({ ctx, next }: { ctx: Context; next: (opts: { ctx: Context & { user: JWTPayload } }) => Promise<any> }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
    }
    return next({ ctx: { ...ctx, user: ctx.user as JWTPayload } });
  },
);

