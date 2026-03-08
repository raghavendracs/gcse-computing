import { z } from "zod";

export const signupInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).default("balanced"),
});

export const loginInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createStudentInputModel = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).default("OCR"),
});

export const deleteStudentInputModel = z.object({
  studentId: z.string(),
});

export const updateProfileInputModel = z.object({
  fullName: z.string().min(1).optional(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).optional(),
});

export const publicUserModel = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(["parent", "student"]),
  parentId: z.string().optional(),
  examBoardPreference: z.enum(["OCR", "AQA", "Edexcel"]).optional(),
  aiModelPreference: z.enum(["accurate", "balanced", "budget"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
