import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useTopicTree = () => {
  const query = trpc.topics.getTree.useQuery();
  return { tree: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
};

//#endregion  //*======== Queries ===========
