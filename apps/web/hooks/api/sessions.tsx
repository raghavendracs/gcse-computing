import { trpc } from "~/trpc/client";

//#region  //*=========== Mutations ===========

export const useStartSession = () => {
  return trpc.sessions.startSession.useMutation();
};

export const useEndSession = () => {
  return trpc.sessions.endSession.useMutation();
};

//#endregion  //*======== Mutations ===========
