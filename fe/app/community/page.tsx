"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostSummary, User, ReactionType } from "./_types";
import { getPosts, deletePost, reactToPost } from "./_lib/api";
import { timeAgo } from "./_lib/utils";
import Avatar from "./_components/Avatar";
import PostCard from "./_components/PostCard";
import LoginModal from "./_components/LoginModal";

const CATEGORIES = ["전체", "IT/소프트웨어", "경영/경제", "디자인", "AI/데이터", "기타"];

export default function CommunityPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<"feed" | "list">("feed");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── 인증 ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoggedIn(true);
    setCurrentUser({ id: 0, nickname: "테스트유저" });
    // const token = localStorage.getItem("access_token");
    // if (token) {
    //   setIsLoggedIn(true);
    //   // TODO: /me API로 교체
    //   const raw = localStorage.getItem("user");
    //   if (raw) setCurrentUser(JSON.parse(raw));
    // }
  }, []);

  // ── 게시물 목록 로드 ─────────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await getPosts({
        category: selectedCategory === "전체" ? undefined : selectedCategory,
        page,
        page_size: 20,
      });
      setPosts(res.posts);
      setTotalPages(res.total_pages);
    } catch (e) {
      console.error(e);
      setLoadError("게시물을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, page]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // ── 반응 ────────────────────────────────────────────────────────────────────
  const handleReact = async (postId: number, type: ReactionType) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    try {
      await reactToPost(postId, type);
      // 낙관적 업데이트: like 수만 토글
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const alreadyLiked = false; // 목록에선 user_reaction 없으므로 단순 +1
          return {
            ...p,
            reaction_stats: {
              ...p.reaction_stats,
              like: p.reaction_stats.like + 1,
            },
          };
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  // ── 삭제 ────────────────────────────────────────────────────────────────────
  const handleDelete = async (postId: number) => {
    if (!confirm("게시물을 삭제할까요?")) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했어요.");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">자유게시판</h1>
            <p className="text-xs text-gray-400">팀원들과 자유롭게 이야기해요</p>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <button
                onClick={() => router.push("/community/new")}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
              >
                + 글쓰기
              </button>
            )}
            <div className="flex rounded-xl border border-gray-200 bg-white p-1">
              {(["feed", "list"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    tab === t ? "bg-red-600 text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "feed" ? "📰 피드" : "📋 목록"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="mb-5 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setPage(1); }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedCategory === cat
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-500"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 로딩 / 에러 / 빈 상태 */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : loadError ? (
          <div className="py-20 text-center text-sm text-red-400">{loadError}</div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <p className="mb-2 text-3xl">📭</p>
            <p className="text-sm text-gray-400">게시물이 없어요</p>
            {isLoggedIn && (
              <button
                onClick={() => router.push("/community/new")}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                첫 글 쓰기
              </button>
            )}
          </div>
        ) : tab === "feed" ? (
          // ── 피드 뷰 ────────────────────────────────────────────────────────
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                onReact={handleReact}
                onDelete={handleDelete}
                onLoginRequired={() => setShowLoginModal(true)}
              />
            ))}
          </div>
        ) : (
          // ── 목록 뷰 ────────────────────────────────────────────────────────
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <ul className="divide-y divide-gray-50">
              {posts.map((post) => (
                <li
                  key={post.id}
                  onClick={() => router.push(`/community/${post.id}`)}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-gray-50"
                >
                  {post.is_pinned && (
                    <span className="mt-0.5 text-xs">📌</span>
                  )}
                  <Avatar user={post.author} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800">
                        {post.author.nickname}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    {post.title && (
                      <p className="mt-0.5 truncate text-xs font-medium text-gray-700">
                        {post.title}
                      </p>
                    )}
                    <p className="truncate text-xs text-gray-500">
                      {post.content}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1 text-[10px] text-gray-400">
                    <span>❤️ {post.reaction_stats.like}</span>
                    <span>💬 {post.comment_count}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-xs text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </main>

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => router.push("/login")}
        />
      )}
    </div>
  );
}
