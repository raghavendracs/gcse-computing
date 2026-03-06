import { z } from "zod";
import { Types } from "mongoose";
import { Module } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import { listModulesInputModel, moduleOutputModel } from "./models";

export const modulesRouter = router({
  listModules: authenticatedProcedure
    .input(listModulesInputModel)
    .output(z.array(moduleOutputModel))
    .query(async ({ input }) => {
      const conditions: Record<string, unknown> = {};
      if (input.examBoard) {
        conditions.examBoard = { $in: [input.examBoard, "generic"] };
      }
      if (input.topicType) {
        conditions.topicType = input.topicType;
      }

      const modules = await Module.find(conditions).sort({ sortOrder: 1 });
      return modules.map((m) => ({
        id: m._id.toString(),
        examBoard: m.examBoard,
        moduleCode: m.moduleCode,
        moduleName: m.moduleName,
        topicName: m.topicName,
        topicType: m.topicType,
        description: m.description,
        specReferences: m.specReferences,
        difficultyBands: m.difficultyBands,
        sortOrder: m.sortOrder,
      }));
    }),

  getModuleById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .output(moduleOutputModel)
    .query(async ({ input }) => {
      const m = await Module.findOne({ _id: new Types.ObjectId(input.id) });
      if (!m) throw new Error("Module not found");
      return {
        id: m._id.toString(),
        examBoard: m.examBoard,
        moduleCode: m.moduleCode,
        moduleName: m.moduleName,
        topicName: m.topicName,
        topicType: m.topicType,
        description: m.description,
        specReferences: m.specReferences,
        difficultyBands: m.difficultyBands,
        sortOrder: m.sortOrder,
      };
    }),
});
