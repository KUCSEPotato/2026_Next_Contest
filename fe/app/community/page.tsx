"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostSummary, User, ReactionType } from "./_types";
import { getPosts, deletePost, reactToPost, getHotPosts } from "./_lib/api";
import PostCard from "./_components/PostCard";
import LoginModal from "./_components/LoginModal";

const CATEGORIES = [
  { label: "전체", value: undefined },
  { label: "일반", value: "general" },
  { label: "질문", value: "question" },
  { label: "아이디어", value: "idea" },
  { label: "작업 공유", value: "showcase" },
  { label: "이벤트", value: "event" },
  { label: "공지", value: "announcement" },
];

const SERVICE_BLOCKS = [
  {
    title: "프로젝트 탐색",
    description: "진행 중인 아이디어와 프로젝트를 둘러보고 함께할 팀을 찾아보세요.",
    path: "/mainpage",
  },
  {
    title: "아이디어 줍기",
    description: "버려진 아이디어를 이어받아 새로운 프로젝트로 발전시켜보세요.",
    path: "/ideas/pickup",
  },
  {
    title: "자유게시판",
    description: "팀원 모집, 질문, 회고 등 자유롭게 이야기를 나눠보세요.",
    path: "/community",
  },
];

type HotSection = {
  key: "popular" | "most_recommended" | "most_commented" | "most_viewed" | "latest";
  label: string;
  emoji: string;
};

const HOT_SECTIONS: HotSection[] = [
  { key: "popular", label: "인기게시물", emoji: "🔥" },
  { key: "most_recommended", label: "추천 TOP", emoji: "👍" },
  { key: "most_commented", label: "댓글 TOP", emoji: "💬" },
  { key: "most_viewed", label: "조회수 TOP", emoji: "👀" },
  { key: "latest", label: "최신글", emoji: "🆕" },
];

type Tab = "board" | "hot";

export default function CommunityPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [tab, setTab] = useState<Tab>("board");

  const [hotPosts, setHotPosts] = useState<{
    popular: PostSummary | null;
    most_recommended: PostSummary | null;
    most_commented: PostSummary | null;
    most_viewed: PostSummary | null;
    latest: PostSummary | null;
  } | null>(null);
  const [loadingHot, setLoadingHot] = useState(false);

  useEffect(() => {
    window.setTimeout(() => {
      const token = localStorage.getItem("access_token");
      if (token) {
        setIsLoggedIn(true);
        try {
          const raw = localStorage.getItem("user");
          if (raw) setCurrentUser(JSON.parse(raw));
        } catch (e) {
          console.error("유저 정보 파싱 실패", e);
          localStorage.removeItem("user");
        }
      }
    }, 0);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await getPosts({ category: selectedCategory, page, page_size: 20 });
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
    const timer = window.setTimeout(() => {
      loadPosts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const loadHotPosts = useCallback(async () => {
    setLoadingHot(true);
    try {
      const res = await getHotPosts();
      setHotPosts(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHot(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "hot" && !hotPosts) {
      const timer = window.setTimeout(() => {
        loadHotPosts();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [tab, hotPosts, loadHotPosts]);

  const handleReact = async (postId: number, type: ReactionType) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    try {
      const result = await reactToPost(postId, type);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const prevReaction = p.user_reaction;
          const newStats = { ...p.reaction_stats };
          if (result.action === "removed") {
            newStats[type] = Math.max(0, newStats[type] - 1);
            return { ...p, user_reaction: null, reaction_stats: newStats };
          }
          if (prevReaction && prevReaction !== type) {
            newStats[prevReaction] = Math.max(0, newStats[prevReaction] - 1);
          }
          newStats[type] = newStats[type] + 1;
          return {
            ...p,
            user_reaction: type,
            reaction_stats: newStats,
          };
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

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

  const handleWriteClick = () => {
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    router.push("/community/new");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-4">
        <button
          onClick={() => router.push("/notifications")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-red-300 hover:text-red-600"
        >
          알림
        </button>
        <button
          onClick={() => router.push("/chat")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-red-300 hover:text-red-600"
        >
          채팅
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="py-10 text-center sm:py-14">
          <h1 className="mb-3 text-2xl font-bold leading-tight text-gray-900 sm:text-4xl">
            자유롭게 묻고,
            <br className="sm:hidden" /> 함께 나누는 공간
          </h1>
          <p className="mb-8 text-sm text-gray-500 sm:text-base">
            팀원 모집, 질문, 회고, 작업 공유까지 자유롭게 이야기해보세요
          </p>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {SERVICE_BLOCKS.map((block) => {
              const isActive = block.path === "/community";
              return (
                <button
                  key={block.title}
                  onClick={() => router.push(block.path)}
                  className={`rounded-2xl border p-5 shadow-sm transition hover:border-red-300 hover:shadow-md ${
                    isActive ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`text-base font-bold ${isActive ? "text-red-600" : "text-gray-900"}`}>
                      {block.title}
                    </p>
                    {isActive && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        현재
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-gray-500">{block.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 탭 전환 */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTab("board")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              tab === "board"
                ? "bg-red-600 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600"
            }`}
          >
            자유게시판
          </button>
          <button
            onClick={() => setTab("hot")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              tab === "hot"
                ? "bg-red-600 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600"
            }`}
          >
            🔥 핫게시물
          </button>
        </div>

        {/* 자유게시판 탭 */}
        {tab === "board" && (
          <>
            <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">자유게시판</p>
                  <p className="mt-1 text-sm text-gray-500">
                    관심 있는 주제의 글을 둘러보고 자유롭게 의견을 나눠보세요.
                  </p>
                </div>
                <button
                  onClick={handleWriteClick}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  글쓰기
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => { setSelectedCategory(cat.value); setPage(1); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedCategory === cat.value
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </section>

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-500">게시물을 불러오는 중...</div>
            ) : loadError ? (
              <div className="py-16 text-center text-sm text-red-500">{loadError}</div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-3 text-3xl">📭</p>
                <p className="mb-1 text-sm font-medium text-gray-600">게시물이 없어요</p>
                <p className="text-xs text-gray-400">자유게시판의 첫 글을 작성해보세요</p>
                {isLoggedIn && (
                  <button
                    onClick={() => router.push("/community/new")}
                    className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    첫 글 쓰기
                  </button>
                )}
              </div>
            ) : (
              <section className="mb-10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900">전체 게시글</span>
                  <span className="text-xs text-gray-400">{posts.length}개의 글</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
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
              </section>
            )}

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-xs text-gray-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}

        {/* 핫게시물 탭 */}
        {tab === "hot" && (
          <section>
            <div className="mb-6">
              <p className="text-lg font-bold text-gray-900">🔥 핫게시물</p>
              <p className="mt-1 text-sm text-gray-500">
                지금 가장 주목받는 글을 모아봤어요. 겹치는 글은 인기게시물에만 표시돼요.
              </p>
            </div>

            {loadingHot ? (
              <div className="py-16 text-center text-sm text-gray-500">불러오는 중...</div>
            ) : !hotPosts ? (
              <div className="py-16 text-center text-sm text-red-400">핫게시물을 불러오지 못했어요.</div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {HOT_SECTIONS.map(({ key, label, emoji }) => {
                  const post = hotPosts[key];
                  if (!post) return null;
                  return (
                    <div key={key} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-base">{emoji}</span>
                        <span className="text-sm font-bold text-gray-800">{label}</span>
                      </div>
                      <PostCard
                        post={post}
                        currentUser={currentUser}
                        onReact={handleReact}
                        onDelete={handleDelete}
                        onLoginRequired={() => setShowLoginModal(true)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
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
