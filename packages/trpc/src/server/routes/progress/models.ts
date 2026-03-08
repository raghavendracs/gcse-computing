import { z } from "zod";

const moduleWeakAreaFlagsModel = z.object({
  hintDependent: z.boolean(),
  lowAccuracy: z.boolean(),
  errorProne: z.boolean(),
});

const moduleProgressModel = z.object({
  moduleId: z.string(),
  moduleName: z.string(),
  totalAttempts: z.number(),
  averageScore: z.number(),
  lastAttemptAt: z.string(),
  hintsPerQuestion: z.number(),
  weakAreaFlags: moduleWeakAreaFlagsModel,
});

const weakAreaModel = z.object({
  moduleId: z.string(),
  moduleName: z.string(),
  reasons: z.array(z.string()),
  suggestedAction: z.string(),
});

export const getSummaryOutputModel = z.object({
  streak: z.object({
    currentDays: z.number(),
    lastActivityDate: z.string(),
  }),
  moduleProgress: z.array(moduleProgressModel),
  weakAreas: z.array(weakAreaModel),
  totalAttempts: z.number(),
}).nullable();

export const getModuleProgressInputModel = z.object({
  moduleId: z.string(),
});

export const getModuleProgressOutputModel = moduleProgressModel.nullable();
