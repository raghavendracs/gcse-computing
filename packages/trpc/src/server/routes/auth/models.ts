import { z } from "zod";

export const signupInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  displayName: z.string().min(1),
});

export const loginInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileInputModel = z.object({
  fullName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
});

export const publicUserModel = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  displayName: z.string(),
  totalPoints: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
