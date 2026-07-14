import { trpc } from "~/trpc/client";

//#region  //*=========== Queries ===========

export const useGetForTopic = (q: {
  topicId: string;
  difficulty?: "easy" | "medium" | "hard";
  excludeQuestionId?: string;
  enabled?: boolean;
}) => {
  const query = trpc.questions.getForTopic.useQuery(
    { topicId: q.topicId, difficulty: q.difficulty, excludeQuestionId: q.excludeQuestionId },
    { enabled: (q.enabled ?? true) && !!q.topicId },
  );
  return {
    question: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useListForTopic = (topicId: string, enabled = true) => {
  const query = trpc.questions.listForTopic.useQuery(
    { topicId },
    { enabled: enabled && !!topicId },
  );
  return {
    questions: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useGetQuestionById = (questionId: string) => {
  const query = trpc.questions.getById.useQuery(
    { questionId },
    { enabled: !!questionId },
  );
  return {
    question: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

//#endregion  //*======== Queries ===========

//#region  //*=========== Mutations ===========

export const useRunCode = () => {
  return trpc.questions.runCode.useMutation();
};

export const useRunWithInput = () => {
  return trpc.questions.runWithInput.useMutation();
};

export const useSubmit = () => {
  const utils = trpc.useUtils();
  return trpc.questions.submit.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.topics.getTree.invalidate(),
        utils.leaderboard.top.invalidate(),
        utils.history.listAttempts.invalidate(),
        utils.questions.listForTopic.invalidate(),
      ]);
    },
  });
};

export const useRequestCodingHint = () => {
  return trpc.questions.requestCodingHint.useMutation();
};

//#endregion  //*======== Mutations ===========
