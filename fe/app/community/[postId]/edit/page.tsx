"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { User } from "../../_types";
import { getPost, updatePost } from "../../_lib/api";

const CATEGORIES = [
  { label: "일반", value: "general" },
  { label: "질문", value: "question" },
  { label: "아이디어", value: "idea" },
  { label: "작업 공유", value: "showcase" },
];

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function EditPostPage() {
  const router = useRouter();
  const { postId } = useParams<{ postId: string }>();
  const pid = Number(postId);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.resolve().then(async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      let user: User | null = null;
      try {
        const raw = localStorage.getItem("user");
        if (raw) {
          user = JSON.parse(raw) as User;
          setCurrentUser(user);
        }
      } catch (e) {
        console.error("유저 정보 파싱 실패", e);
        localStorage.removeItem("user");
      }

      try {
        const post = await getPost(pid);
        if (user && user.id !== post.author_id) {
          router.replace(`/community/${pid}`);
          return;
        }

        setTitle(post.title ?? "");
        setContent(post.content);
        setCategory(post.category ?? "");
      } catch (e: unknown) {
        setError(getErrorMessage(e, "게시물을 불러오지 못했어요."));
      } finally {
        setLoading(false);
      }
    });
  }, [pid, router]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await updatePost(pid, {
        title: title.trim() || undefined,
        content: content.trim(),
        category: category || undefined,
      });
      router.push(`/community/${pid}`);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "게시물 수정에 실패했어요."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
          >
            취소
          </button>
          <h1 className="text-base font-bold text-gray-900">게시물 수정</h1>
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="rounded-xl bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-500">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (선택사항)"
            className="mb-3 w-full border-b border-gray-100 bg-white pb-3 text-base font-semibold text-gray-900 outline-none placeholder:text-gray-300"
          />
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력해주세요."
            rows={10}
            className="w-full resize-none bg-white text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
          />
        </div>

        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">카테고리</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(category === cat.value ? "" : cat.value)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  category === cat.value
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
