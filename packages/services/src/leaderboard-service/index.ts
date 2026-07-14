import { User } from "@gcse/database";

class LeaderboardService {
  async top(limit = 20): Promise<Array<{ rank: number; displayName: string; totalPoints: number }>> {
    const users = await User.find({ deletedAt: null })
      .sort({ totalPoints: -1 })
      .limit(limit)
      .lean();
    return users.map((u: any, i: number) => ({
      rank: i + 1,
      displayName: u.displayName,
      totalPoints: u.totalPoints ?? 0,
    }));
  }
}

export default LeaderboardService;
