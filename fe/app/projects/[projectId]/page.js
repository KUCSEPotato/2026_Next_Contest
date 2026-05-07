"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProjectApi,
  applyProjectApi,
  requestAdoptionApi,
  getMyProfileApi,
} from "../../../lib/api";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const [adoptionMessage, setAdoptionMessage] = useState("");
  const [isRequestingAdoption, setIsRequestingAdoption] = useState(false);

  const textareaClassName =
    "mt-4 min-h-32 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  useEffect(() => {
    async function fetchProject() {
      try {
        const [projectResult, profileResult] = await Promise.all([
          getProjectApi(projectId),
          getMyProfileApi(),
        ]);

        setProject(projectResult.data);
        setMyProfile(profileResult.data);
      } catch (error) {
        console.error(error);
        alert("프로젝트 정보를 불러오지 못했습니다.");
      }
    }

    fetchProject();
  }, [projectId]);

  const isLeader = project?.leader_id === myProfile?.id;

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

  const handleAdoptionRequest = async () => {
    if (!adoptionMessage.trim()) {
      alert("이어받기 요청 메시지를 입력해주세요.");
      return;
    }

    try {
      setIsRequestingAdoption(true);
      const result = await requestAdoptionApi(projectId, adoptionMessage);
      console.log("이어받기 요청 성공:", result);
      alert("이어받기 요청이 완료되었습니다.");
      setAdoptionMessage("");
    } catch (error) {
      console.error(error);
      alert("이어받기 요청에 실패했습니다.");
    } finally {
      setIsRequestingAdoption(false);
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

          <h1 className="text-3xl font-bold text-slate-900">
            {project.title}
          </h1>

          <p className="mt-3 text-lg text-slate-600">{project.summary}</p>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm font-semibold text-slate-700">
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

          <button
            onClick={() => router.push(`/projects/${projectId}/chat`)}
            className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            팀 채팅방 들어가기
          </button>
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

            {isLeader ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  지원자 관리
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  이 프로젝트에 지원한 사람들을 확인하고 팀원을 확정할 수 있습니다.
                </p>

                <button
                  onClick={() => router.push(`/projects/${projectId}/manage`)}
                  className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                >
                  지원자 관리하기
                </button>
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  프로젝트 지원하기
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  팀장에게 보낼 간단한 소개와 참여 의지를 적어주세요.
                </p>

                <textarea
                  className={textareaClassName}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="예: React와 UI 구현을 맡아 참여하고 싶습니다."
                />

                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isApplying ? "지원 중..." : "지원하기"}
                </button>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                프로젝트 이어받기
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                이 프로젝트를 이어서 진행하고 싶은 이유를 작성해주세요.
              </p>

              <textarea
                className={textareaClassName}
                value={adoptionMessage}
                onChange={(e) => setAdoptionMessage(e.target.value)}
                placeholder="예: 기존 아이디어를 발전시켜 완성도 높은 서비스로 이어가고 싶습니다."
              />

              <button
                onClick={handleAdoptionRequest}
                disabled={isRequestingAdoption}
                className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isRequestingAdoption ? "요청 중..." : "이어받기 요청하기"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}