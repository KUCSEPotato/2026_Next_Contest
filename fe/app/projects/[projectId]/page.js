"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProjectApi, applyProjectApi } from "../../../lib/api";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId;

  const [project, setProject] = useState(null);
  const [message, setMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      try {
        const result = await getProjectApi(projectId);
        setProject(result.data);
      } catch (error) {
        console.error(error);
        alert("프로젝트 정보를 불러오지 못했습니다.");
      }
    }

    fetchProject();
  }, [projectId]);

  const handleApply = async () => {
    if (!message.trim()) {
      alert("지원 메시지를 입력해주세요.");
      return;
    }

    try {
      setIsApplying(true);

      const result = await applyProjectApi(projectId, message);

      console.log("지원 성공:", result);
      alert("프로젝트 지원이 완료되었습니다.");
      setMessage("");
    } catch (error) {
      console.error(error);
      alert("프로젝트 지원에 실패했습니다.");
    } finally {
      setIsApplying(false);
    }
  };

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-600">프로젝트 정보를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
              {project.status}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              난이도 {project.difficulty}
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {project.title}
          </h1>

          <p className="mt-3 text-lg text-slate-600">{project.summary}</p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>진행률</span>
              <span>{project.progress_percent}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-red-600"
                style={{ width: `${project.progress_percent}%` }}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">프로젝트 설명</h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-700">
              {project.description}
            </p>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">팀 정보</h2>

              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  리더 ID:{" "}
                  <span className="font-semibold text-slate-900">
                    {project.leader_id}
                  </span>
                </p>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    참여 멤버
                  </p>
                  <div className="space-y-2">
                    {project.members.map((member) => (
                      <div
                        key={`${member.user_id}-${member.role_in_project}`}
                        className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        User #{member.user_id} · {member.role_in_project}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                프로젝트 지원하기
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                팀장에게 보낼 간단한 소개와 참여 의지를 적어주세요.
              </p>

              <textarea
                className="mt-4 min-h-32 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="예: React와 UI 구현을 맡아 참여하고 싶습니다."
              />

              <button
                onClick={handleApply}
                disabled={isApplying}
                className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isApplying ? "지원 중..." : "지원하기"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}