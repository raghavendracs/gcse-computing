import { z } from "zod";

export const signupParentPayload = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).default("balanced"),
});
export type SignupParentPayload = z.infer<typeof signupParentPayload>;

export const signupStudentPayload = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  parentId: z.string(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).default("OCR"),
});
export type SignupStudentPayload = z.infer<typeof signupStudentPayload>;

export const loginPayload = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginPayload = z.infer<typeof loginPayload>;

export const updateProfilePayload = z.object({
  fullName: z.string().min(1).optional(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).optional(),
});
export type UpdateProfilePayload = z.infer<typeof updateProfilePayload>;
