import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useListAttempts = (filters?: { moduleId?: string; limit?: number }) => {
  const query = trpc.history.listAttempts.useQuery(
    { moduleId: filters?.moduleId, limit: filters?.limit ?? 20 },
    { enabled: true },
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
