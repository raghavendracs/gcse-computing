import { SpecTopic, Module } from "@gcse/database";
import { authenticatedProcedure, router } from "../../trpc";
import { getByExamBoardInputModel, getByExamBoardOutputModel } from "./models";

export const curriculumRouter = router({
  getByExamBoard: authenticatedProcedure
    .input(getByExamBoardInputModel)
    .output(getByExamBoardOutputModel)
    .query(async ({ input }) => {
      const topics = await SpecTopic.find({ examBoard: input.examBoard }).sort({ sortOrder: 1 });
      const modules = await Module.find({ examBoard: input.examBoard }).select("_id specReferences");

      return topics.map((topic) => {
        const moduleIds = modules
          .filter((m) => m.specReferences.includes(topic.code))
          .map((m) => m._id.toString());

        return {
          id: topic._id.toString(),
          code: topic.code,
          title: topic.title,
          paper: topic.paper,
          topicGroup: topic.topicGroup,
          topicGroupTitle: topic.topicGroupTitle,
          sortOrder: topic.sortOrder,
          moduleIds,
        };
      });
    }),
});
