"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStartSession } from "~/hooks/api/sessions";

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;
  const startSession = useStartSession();

  useEffect(() => {
    startSession
      .mutateAsync({ moduleId, mode: "mixed" })
      .then(({ sessionId }) => {
        router.replace(`/modules/${moduleId}/practice?sessionId=${sessionId}&mode=mixed`);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  return (
    <div className="max-w-2xl space-y-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/4" />
      <div className="h-24 bg-slate-200 rounded" />
      <div className="h-32 bg-slate-200 rounded" />
    </div>
  );
}
