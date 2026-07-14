import { User } from "@gcse/database";

class LeaderboardService {
  async top(limit = 20): Promise<Array<{ rank: number; displayName: string; totalPoints: number }>> {
    // Only rank real (current-schema) accounts. Legacy/pre-rewrite users without a
    // displayName are excluded so the public leaderboard never fails validation.
    const users = await User.find({
      deletedAt: null,
      displayName: { $type: "string", $ne: "" },
    })
      .sort({ totalPoints: -1 })
      .limit(limit)
      .lean();
    return users
      .filter((u: any) => typeof u.displayName === "string" && u.displayName.length > 0)
      .map((u: any, i: number) => ({
        rank: i + 1,
        displayName: u.displayName,
        totalPoints: typeof u.totalPoints === "number" ? u.totalPoints : 0,
      }));
  }
}

export default LeaderboardService;
