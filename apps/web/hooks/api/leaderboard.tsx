import { trpc } from "~/trpc/client";

export const useLeaderboard = (limit = 20) => {
  const query = trpc.leaderboard.top.useQuery({ limit });
  return { entries: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
};
