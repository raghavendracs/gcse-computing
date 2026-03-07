import { trpc } from "~/trpc/client";

//#region  //*=========== Mutations ===========

export const useGenerateQuestion = () => {
  return trpc.questions.generateQuestion.useMutation();
};

export const useSubmitAnswer = () => {
  const utils = trpc.useUtils();
  return trpc.questions.submitAnswer.useMutation({
    onSuccess: async () => {
      await utils.history.listAttempts.invalidate();
    },
  });
};

export const useRequestHint = () => {
  return trpc.questions.requestHint.useMutation();
};

export const useRunCode = () => {
  return trpc.questions.runCode.useMutation();
};

export const useRequestCodingHint = () => {
  return trpc.questions.requestCodingHint.useMutation();
};

//#endregion  //*======== Mutations ===========
