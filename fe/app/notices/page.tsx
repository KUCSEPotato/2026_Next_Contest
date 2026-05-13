"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostSummary } from "../community/_types";
import { getPosts } from "../community/_lib/api";
import { timeAgo } from "../community/_lib/utils";

function getFirstLine(content: string) {
  const line = content
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  return line || "공지 본문이 없습니다.";
}

export default function NoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getPosts({
        category: "announcement",
        page: 1,
        page_size: 50,
        sort_by: "latest",
      });
      setNotices(result.posts || []);
    } catch (err) {
      console.error(err);
      setError("공지 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadNotices();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotices]);

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

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">공지 목록을 불러오는 중...</p>
          ) : error ? (
            <p className="px-5 py-12 text-center text-sm text-red-400">{error}</p>
          ) : notices.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">등록된 공지가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notices.map((notice) => (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => router.push(`/notices/${notice.id}`)}
                  className="block w-full px-5 py-5 text-left transition hover:bg-gray-50"
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-red-700" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <h2 className="line-clamp-1 text-base font-bold text-gray-900">
                            {notice.title || "제목 없는 공지"}
                          </h2>
                          <p className="mt-1 text-xs font-medium text-red-700">관리자</p>
                        </div>
                        <div className="shrink-0 text-left text-xs text-gray-400 sm:text-right">
                          <p className="font-semibold text-gray-700">게시일시:</p>
                          <p>{timeAgo(notice.created_at)}</p>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm leading-6 text-gray-700">
                        {getFirstLine(notice.content)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
