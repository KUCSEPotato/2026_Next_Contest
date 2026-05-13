"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  bookmarkIdeaApi,
  getIdeaApi,
  likeIdeaApi,
  pickupIdeaApi,
  unbookmarkIdeaApi,
  unlikeIdeaApi,
} from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";
import { useDialog, useToast } from "../../../../components/AppFeedback";
import { confirmWaterdropSpend } from "../../../../lib/waterdrops";

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
  like_count?: number;
  bookmark_count?: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

export default function PickupIdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { confirmCoinSpend } = useDialog();
  const ideaId = params.ideaId as string;

  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [reactionBusy, setReactionBusy] = useState<"like" | "bookmark" | null>(null);

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
      const canSpend = await confirmWaterdropSpend({
        confirmCoinSpend,
        toast,
        actionLabel: "프로젝트 생성",
      });
      if (!canSpend) return;

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

  const handleToggleLike = async () => {
    if (!idea || reactionBusy) return;
    if (!getToken()) {
      alert("로그인 후 좋아요를 누를 수 있어요.");
      return;
    }

    const previous = idea;
    const nextLiked = !idea.is_liked;
    setIdea({
      ...idea,
      is_liked: nextLiked,
      like_count: Math.max(0, Number(idea.like_count || 0) + (nextLiked ? 1 : -1)),
    });

    try {
      setReactionBusy("like");
      if (nextLiked) {
        await likeIdeaApi(idea.id);
      } else {
        await unlikeIdeaApi(idea.id);
      }
    } catch (error) {
      setIdea(previous);
      alert(error instanceof Error ? error.message : "좋아요 처리에 실패했습니다.");
    } finally {
      setReactionBusy(null);
    }
  };

  const handleToggleBookmark = async () => {
    if (!idea || reactionBusy) return;
    if (!getToken()) {
      alert("로그인 후 북마크할 수 있어요.");
      return;
    }

    const previous = idea;
    const nextBookmarked = !idea.is_bookmarked;
    setIdea({
      ...idea,
      is_bookmarked: nextBookmarked,
      bookmark_count: Math.max(0, Number(idea.bookmark_count || 0) + (nextBookmarked ? 1 : -1)),
    });

    try {
      setReactionBusy("bookmark");
      if (nextBookmarked) {
        await bookmarkIdeaApi(idea.id);
      } else {
        await unbookmarkIdeaApi(idea.id);
      }
    } catch (error) {
      setIdea(previous);
      alert(error instanceof Error ? error.message : "북마크 처리에 실패했습니다.");
    } finally {
      setReactionBusy(null);
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

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={reactionBusy !== null}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                idea.is_liked
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:text-rose-500"
              }`}
              aria-pressed={Boolean(idea.is_liked)}
            >
              좋아요 {Number(idea.like_count || 0)}
            </button>
            <button
              type="button"
              onClick={handleToggleBookmark}
              disabled={reactionBusy !== null}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                idea.is_bookmarked
                  ? "border-amber-200 bg-amber-50 text-amber-600"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-500"
              }`}
              aria-pressed={Boolean(idea.is_bookmarked)}
            >
              북마크 {Number(idea.bookmark_count || 0)}
            </button>
          </div>
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
