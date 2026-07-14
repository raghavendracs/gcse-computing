import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import {
  signupInputModel,
  loginInputModel,
  updateProfileInputModel,
  publicUserModel,
} from "./models";
import { AuthService } from "@gcse/services";

const authService = new AuthService(process.env.JWT_SECRET || "dev-secret-change-in-production");

export const authRouter = router({
  signup: publicProcedure
    .input(signupInputModel)
    .output(z.object({ user: publicUserModel }))
    .mutation(async ({ ctx, input }) => {
      await authService.signup(input);
      const { token, user } = await authService.login({
        email: input.email,
        password: input.password,
      });
      ctx.res.cookie("gcse_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return { user };
    }),

  login: publicProcedure
    .input(loginInputModel)
    .output(z.object({ user: publicUserModel }))
    .mutation(async ({ ctx, input }) => {
      const { token, user } = await authService.login(input);
      ctx.res.cookie("gcse_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return { user };
    }),

  logout: authenticatedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      ctx.res.clearCookie("gcse_token");
      return { success: true };
    }),

  me: authenticatedProcedure
    .output(publicUserModel)
    .query(async ({ ctx }) => {
      try {
        return await authService.getUserById(ctx.user!.userId);
      } catch {
        // Valid JWT but the user no longer exists (e.g. account deleted or DB
        // reset). Clear the stale cookie and report a clean 401 instead of 500.
        ctx.res.clearCookie("gcse_token");
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Session no longer valid" });
      }
    }),

  updateProfile: authenticatedProcedure
    .input(updateProfileInputModel)
    .output(publicUserModel)
    .mutation(async ({ ctx, input }) => {
      return authService.updateProfile(ctx.user!.userId, input);
    }),
});
