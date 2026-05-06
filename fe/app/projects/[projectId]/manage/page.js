"use client";

import { useParams } from "next/navigation";

export default function ProjectManagePage() {
  const params = useParams();
  const projectId = params.projectId;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-red-600">
          Project #{projectId}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          프로젝트 진행 관리
        </h1>
        <p className="mt-3 text-slate-500">
          이 페이지는 진행 관리 기능 구현 예정입니다.
        </p>
      </div>
    </main>
  );
}