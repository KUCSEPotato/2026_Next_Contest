"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getIdeaApi, pickupIdeaApi } from "../../../../lib/api";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "고급",
};

interface IdeaDetail {
  id: number;
  title?: string;
  summary?: string;
  description?: string;
  difficulty?: string;
  domain?: string;
}

export default function PickupIdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ideaId = params.ideaId as string;

  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPickingUp, setIsPickingUp] = useState(false);

  useEffect(() => {
    async function loadIdea() {
      try {
        setLoading(true);

        const result = await getIdeaApi(ideaId);
        setIdea(result.data);
      } catch (error) {
        console.error(error);
        alert("아이디어 정보를 불러오지 못했습니다.");
        router.push("/ideas/pickup");
      } finally {
        setLoading(false);
      }
    }

    if (ideaId) {
      loadIdea();
    }
  }, [ideaId, router]);

  const handlePickup = async () => {
    if (!idea) return;

    const ok = window.confirm(
      "이 아이디어를 내 프로젝트로 만들까요?\n\n생성 후에는 내가 리더인 새 프로젝트로 이동합니다."
    );

    if (!ok) return;

    try {
      setIsPickingUp(true);

      const result = await pickupIdeaApi(idea.id);
      const projectId = result.data?.project_id;

      if (!projectId) {
        throw new Error("프로젝트 생성 응답이 올바르지 않습니다.");
      }

      alert("아이디어가 내 프로젝트로 만들어졌습니다.");
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "아이디어를 내 프로젝트로 만들지 못했습니다.");
    } finally {
      setIsPickingUp(false);
    }
  };

  const handleReturnToWell = () => {
    router.push("/ideas/pickup");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-600">아이디어 정보를 불러오는 중...</p>
      </main>
    );
  }

  if (!idea) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-600">아이디어를 찾을 수 없습니다.</p>
      </main>
    );
  }

  const difficultyLabel =
    DIFFICULTY_LABELS[idea.difficulty || ""] || idea.difficulty || "난이도 미정";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <button
          onClick={handleReturnToWell}
          className="mb-5 text-sm font-semibold text-slate-500 transition hover:text-emerald-700"
        >
          생각의 뜰으로 돌아가기
        </button>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {difficultyLabel}
            </span>

            {idea.domain && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {idea.domain}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            {idea.title || "제목 없는 아이디어"}
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            {idea.summary || "한줄소개가 없습니다."}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">상세내용</h2>

          <div
            className="mt-4 whitespace-pre-line leading-7 text-slate-700"
            dangerouslySetInnerHTML={{
              __html: (idea.description || "상세내용이 없습니다.").replace(
                /\n/g,
                "<br />"
              ),
            }}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleReturnToWell}
              disabled={isPickingUp}
              className="flex-1 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              다시 뜰로 보내기
            </button>

            <button
              onClick={handlePickup}
              disabled={isPickingUp}
              className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isPickingUp ? "프로젝트로 만드는 중..." : "내 프로젝트로 만들기"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
