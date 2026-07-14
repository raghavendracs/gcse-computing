import { inferAsyncReturnType } from "@trpc/server";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface JWTPayload {
  userId: string;
}

export interface TRPCContext {
  req: Request;
  res: Response;
  user: JWTPayload | null;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TRPCContext> {
  const token = req.cookies?.gcse_token;
  let user: JWTPayload | null = null;

  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch {
      // Invalid token — user stays null
    }
  }

  return { req, res, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;
