import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useListModules = (filters?: {
  examBoard?: "OCR" | "AQA" | "Edexcel" | "generic";
  topicType?: "theory" | "programming" | "mixed";
}) => {
  const query = trpc.modules.listModules.useQuery(filters ?? {});
  return {
    modules: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};

export const useGetModule = (id: string) => {
  const query = trpc.modules.getModuleById.useQuery(
    { id },
    { enabled: !!id },
  );
  return {
    module: query.data,
    isLoading: query.isLoading,
  };
};

//#endregion  //*======== Queries ===========
