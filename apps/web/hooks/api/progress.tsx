import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useGetProgress = () => {
  const query = trpc.progress.getSummary.useQuery(undefined, { enabled: true });
  return {
    progress: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useGetModuleProgress = (moduleId: string) => {
  const query = trpc.progress.getModuleProgress.useQuery(
    { moduleId },
    { enabled: !!moduleId },
  );
  return {
    moduleProgress: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

//#endregion  //*======== Queries ===========
