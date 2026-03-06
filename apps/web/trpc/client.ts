"use client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@gcse/trpc/client";

export const trpc = createTRPCReact<AppRouter>();
