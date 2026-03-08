import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useGetCurriculum = (examBoard: "OCR" | "AQA" | "Edexcel" | undefined) => {
  const query = trpc.curriculum.getByExamBoard.useQuery(
    { examBoard: examBoard! },
    { enabled: !!examBoard },
  );
  return {
    topics: query.data ?? [],
    isLoading: query.isLoading,
  };
};

//#endregion  //*======== Queries ===========
