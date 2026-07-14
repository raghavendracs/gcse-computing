import { z } from "zod";

export const signupPayload = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  displayName: z.string().min(2).max(30),
});
export type SignupPayload = z.infer<typeof signupPayload>;

export const loginPayload = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginPayload = z.infer<typeof loginPayload>;

export const updateProfilePayload = z.object({
  fullName: z.string().min(1).optional(),
  displayName: z.string().min(2).max(30).optional(),
});
export type UpdateProfilePayload = z.infer<typeof updateProfilePayload>;
