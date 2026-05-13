"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostDetail } from "../../community/_types";
import { getPost } from "../../community/_lib/api";
import { timeAgo } from "../../community/_lib/utils";

export default function NoticeDetailPage() {
  const router = useRouter();
  const { postId } = useParams<{ postId: string }>();
  const noticeId = Number(postId);
  const [notice, setNotice] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotice = useCallback(async () => {
    if (!Number.isFinite(noticeId)) {
      setError("공지 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getPost(noticeId);
      if (!["announcement", "event"].includes(data.category || "")) {
        setError("공지 정보를 찾을 수 없습니다.");
        setNotice(null);
        return;
      }
      setNotice(data);
    } catch (err) {
      console.error(err);
      setError("공지 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadNotice();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotice]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        공지를 불러오는 중...
      </div>
    );
  }

  if (!notice || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50">
        <p className="text-sm text-gray-500">{error || "공지 정보를 찾을 수 없습니다."}</p>
        <button
          type="button"
          onClick={() => router.push("/notices")}
          className="text-xs text-red-500 underline"
        >
          공지 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const title = notice.category === "event"
    ? `<이벤트> ${notice.title || "제목 없는 공지"}`
    : notice.title || "제목 없는 공지";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <button
          type="button"
          onClick={() => router.push("/notices")}
          className="mb-5 text-sm font-medium text-gray-500 transition hover:text-gray-800"
        >
          공지 목록
        </button>

        <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4" />

          <div className="p-5">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-bold text-red-600">
                관
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-7 text-gray-900">
                  {title}
                </h1>
                <p className="mt-1 text-xs font-semibold text-red-600">관리자</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>게시자: 관리자</span>
                  <span>·</span>
                  <span>{timeAgo(notice.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
              {notice.content}
            </div>

            <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-400">
              이 공지사항에는 댓글을 작성할 수 없습니다.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
