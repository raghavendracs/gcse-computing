import { trpc } from "~/trpc/client";
import { useRouter } from "next/navigation";

//#region  //*=========== Mutations ===========

export const useLogin = () => {
  const utils = trpc.useUtils();
  return trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
};

export const useSignup = () => {
  return trpc.auth.signup.useMutation();
};

export const useLogout = () => {
  const utils = trpc.useUtils();
  const router = useRouter();
  return trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.reset();
      router.push("/login");
    },
  });
};

export const useCreateStudent = () => {
  const utils = trpc.useUtils();
  return trpc.auth.createStudent.useMutation({
    onSuccess: async () => {
      await utils.auth.getStudents.invalidate();
    },
  });
};

export const useUpdateProfile = () => {
  const utils = trpc.useUtils();
  return trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
};

//#endregion  //*======== Mutations ===========

//#region  //*=========== Queries ===========

export const useMe = () => {
  const query = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });
  return {
    user: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};

export const useStudents = () => {
  const query = trpc.auth.getStudents.useQuery();
  return {
    students: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};

//#endregion  //*======== Queries ===========
