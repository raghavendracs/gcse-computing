import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useListAttempts = (filters?: { topicIds?: string[]; limit?: number; continuationToken?: string; enabled?: boolean }) => {
  const query = trpc.history.listAttempts.useQuery(
    { topicIds: filters?.topicIds, limit: filters?.limit ?? 20, continuationToken: filters?.continuationToken },
    { enabled: filters?.enabled ?? true },
  );
  return {
    attempts: query.data?.attempts ?? [],
    hasMore: query.data?.hasMore ?? false,
    continuationToken: query.data?.continuationToken ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useGetAttemptDetail = (attemptId: string) => {
  const query = trpc.history.getAttemptDetail.useQuery(
    { attemptId },
    { enabled: !!attemptId },
  );
  return {
    attempt: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

//#endregion  //*======== Queries ===========
