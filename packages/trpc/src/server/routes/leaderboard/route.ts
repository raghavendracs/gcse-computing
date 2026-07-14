import { LeaderboardService } from "@gcse/services";
import { publicProcedure, router } from "../../trpc";
import { leaderboardInputModel, leaderboardOutputModel } from "./models";

const leaderboardSvc = new LeaderboardService();

export const leaderboardRouter = router({
  top: publicProcedure
    .input(leaderboardInputModel)
    .output(leaderboardOutputModel)
    .query(async ({ input }) => leaderboardSvc.top(input.limit)),
});
