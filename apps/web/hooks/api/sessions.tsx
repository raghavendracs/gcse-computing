import { trpc } from "~/trpc/client";

//#region  //*=========== Mutations ===========

export const useStartSession = () => {
  return trpc.sessions.startSession.useMutation();
};

export const useEndSession = () => {
  return trpc.sessions.endSession.useMutation();
};

//#endregion  //*======== Mutations ===========

//#region  //*=========== Queries ===========

export const useListSessions = (opts?: { limit?: number; enabled?: boolean }) => {
  const query = trpc.sessions.listSessions.useQuery(
    { limit: opts?.limit ?? 20 },
    { enabled: opts?.enabled ?? true },
  );
  return {
    sessions: query.data?.sessions ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
};

export const useListStudentSessions = (studentId: string | undefined) => {
  const query = trpc.sessions.listStudentSessions.useQuery(
    { studentId: studentId ?? "", limit: 20 },
    { enabled: !!studentId },
  );
  return {
    sessions: query.data?.sessions ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
};

export const useGetTotalTimeSpent = () => {
  const query = trpc.sessions.getTotalTimeSpent.useQuery();
  return {
    totalSeconds: query.data?.totalSeconds ?? 0,
    isLoading: query.isLoading,
  };
};

//#endregion  //*======== Queries ===========
