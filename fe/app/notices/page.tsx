"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostSummary } from "../community/_types";
import { getPosts } from "../community/_lib/api";
import { timeAgo } from "../community/_lib/utils";
import { NOTICE_READ_IDS_STORAGE_KEY } from "../../components/TopActionButtons";

function getFirstLine(content: string) {
  const line = content
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  return line || "공지 본문이 없습니다.";
}

function withEventPrefix(post: PostSummary) {
  const title = post.title || "제목 없는 공지";
  return post.category === "event" ? `<이벤트> ${title}` : title;
}

function getReadNoticeIds() {
  if (typeof window === "undefined") return new Set<number>();

  try {
    const parsed = JSON.parse(localStorage.getItem(NOTICE_READ_IDS_STORAGE_KEY) || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : []
    );
  } catch {
    return new Set<number>();
  }
}

function saveReadNoticeId(noticeId: number) {
  const readIds = getReadNoticeIds();
  readIds.add(noticeId);
  localStorage.setItem(NOTICE_READ_IDS_STORAGE_KEY, JSON.stringify([...readIds]));
  return readIds;
}

export default function NoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<PostSummary[]>([]);
  const [readNoticeIds, setReadNoticeIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [announcementResult, eventResult] = await Promise.all([
        getPosts({
          category: "announcement",
          page: 1,
          page_size: 50,
          sort_by: "latest",
        }),
        getPosts({
          category: "event",
          page: 1,
          page_size: 50,
          sort_by: "latest",
        }),
      ]);
      setNotices(
        [...(announcementResult.posts || []), ...(eventResult.posts || [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
    } catch (err) {
      console.error(err);
      setError("공지 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReadNoticeIds(getReadNoticeIds());
      loadNotices();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotices]);

  useEffect(() => {
    const syncReadIds = () => setReadNoticeIds(getReadNoticeIds());

    window.addEventListener("focus", syncReadIds);
    window.addEventListener("storage", syncReadIds);
    return () => {
      window.removeEventListener("focus", syncReadIds);
      window.removeEventListener("storage", syncReadIds);
    };
  }, []);

  const openNotice = (noticeId: number) => {
    setReadNoticeIds(saveReadNoticeId(noticeId));
    router.push(`/notices/${noticeId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <section className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-red-600">공지</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">관리자 공지</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Devory에서 전하는 중요한 안내를 확인하세요.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">공지 목록을 불러오는 중...</p>
          ) : error ? (
            <p className="px-5 py-12 text-center text-sm text-red-400">{error}</p>
          ) : notices.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">등록된 공지가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => {
                const isRead = readNoticeIds.has(notice.id);
                return (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => openNotice(notice.id)}
                  className={`block w-full rounded-xl border px-5 py-4 text-left transition ${
                    isRead
                      ? "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                      : "border-red-100 bg-red-50/40 hover:border-red-200 hover:bg-red-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="line-clamp-1 text-base font-bold text-gray-900">
                        {withEventPrefix(notice)}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-700">
                        {getFirstLine(notice.content)}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">{timeAgo(notice.created_at)}</p>
                      <p className="mt-3 text-xs font-semibold text-red-600">
                        클릭하면 공지 상세로 이동합니다.
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        관리자
                      </span>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
