import { z } from "zod";
import {
  authenticatedProcedure,
  parentOnlyProcedure,
  publicProcedure,
  router,
} from "../../trpc";
import {
  signupInputModel,
  loginInputModel,
  createStudentInputModel,
  deleteStudentInputModel,
  updateProfileInputModel,
  publicUserModel,
} from "./models";
import { AuthService } from "@gcse/services";

const authService = new AuthService(process.env.JWT_SECRET || "dev-secret-change-in-production");

export const authRouter = router({
  signup: publicProcedure
    .input(signupInputModel)
    .output(publicUserModel)
    .mutation(async ({ input }) => {
      return authService.signupParent(input);
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
      return authService.getUserById(ctx.user!.userId);
    }),

  createStudent: parentOnlyProcedure
    .input(createStudentInputModel)
    .output(publicUserModel)
    .mutation(async ({ ctx, input }) => {
      return authService.createStudent({
        ...input,
        parentId: ctx.user!.userId,
      });
    }),

  getStudents: parentOnlyProcedure
    .output(z.array(publicUserModel))
    .query(async ({ ctx }) => {
      return authService.getStudentsForParent(ctx.user!.userId);
    }),

  deleteStudent: parentOnlyProcedure
    .input(deleteStudentInputModel)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await authService.deleteStudent(ctx.user!.userId, input.studentId);
      return { success: true };
    }),

  updateProfile: authenticatedProcedure
    .input(updateProfileInputModel)
    .output(publicUserModel)
    .mutation(async ({ ctx, input }) => {
      return authService.updateProfile(ctx.user!.userId, input);
    }),
});
