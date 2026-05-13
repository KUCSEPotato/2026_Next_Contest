"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PostSummary, User, ReactionType } from "./_types";
import { getPosts, deletePost, reactToPost, getHotPosts } from "./_lib/api";
import PostCard from "./_components/PostCard";
import LoginModal from "./_components/LoginModal";
import { ThumbUpIcon } from "./_components/ReactionThumbIcons";
import TopActionButtons from "../../components/TopActionButtons";

const CATEGORIES = [
  { label: "전체", value: undefined },
  { label: "일반", value: "general" },
  { label: "질문", value: "question" },
  { label: "아이디어", value: "idea" },
  { label: "작업 공유", value: "showcase" },
];

const SERVICE_BLOCKS = [
  {
    title: "개발의 땅",
    subtitle: "Devory",
    description: "진행 중인 프로젝트가 자라는 땅에서\n 함께할 팀을 찾아보세요.",
    path: "/mainpage",
    icon: "sprout",
    isActive: false,
  },
  {
    title: "생각의 뜰",
    subtitle: "IdeaYard",
    description: "잠시 멈춘 아이디어 씨앗을 살펴보고\n 다시 싹틔워보세요.",
    path: "/ideas/pickup",
    icon: "seed",
    isActive: false,
  },
  {
    title: "모닥불",
    subtitle: "Campfire",
    description: "팀원 모집, 질문, 회고를 불빛 곁에서 \n편하게 나눠보세요.",
    path: "/community",
    icon: "flame",
    isActive: true,
  },
];

type HotSection = {
  key: "popular" | "most_recommended" | "most_commented" | "most_viewed" | "latest";
  label: string;
  emoji: string;
};

const HOT_SECTIONS: HotSection[] = [
  { key: "popular", label: "인기게시물", emoji: "🔥" },
  { key: "most_recommended", label: "TOP", emoji: "" },
  { key: "most_commented", label: "댓글 TOP", emoji: "💬" },
  { key: "most_viewed", label: "조회수 TOP", emoji: "👀" },
  { key: "latest", label: "최신글", emoji: "🆕" },
];

const ADMIN_ONLY_CATEGORIES = new Set(["announcement", "event"]);

function isCampfirePost(post: PostSummary | null) {
  return Boolean(post && !ADMIN_ONLY_CATEGORIES.has(post.category || ""));
}

type Tab = "board" | "hot";
type HotPostsState = {
  popular: PostSummary | null;
  most_recommended: PostSummary | null;
  most_commented: PostSummary | null;
  most_viewed: PostSummary | null;
  latest: PostSummary | null;
};

function applyPostReaction(
  post: PostSummary,
  type: ReactionType,
  result: Awaited<ReturnType<typeof reactToPost>>
): PostSummary {
  if (result.reaction_stats) {
    return {
      ...post,
      user_reaction: result.user_reaction ?? null,
      reaction_stats: result.reaction_stats,
    };
  }

  const newStats = { ...post.reaction_stats };
  if (result.action === "removed") {
    const rt = result.reaction_type;
    newStats[rt] = Math.max(0, newStats[rt] - 1);
    return { ...post, user_reaction: null, reaction_stats: newStats };
  }
  const prevReaction = post.user_reaction;
  if (prevReaction && prevReaction !== type) {
    newStats[prevReaction] = Math.max(0, newStats[prevReaction] - 1);
  }
  newStats[type] = newStats[type] + 1;
  return {
    ...post,
    user_reaction: type,
    reaction_stats: newStats,
  };
}

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

  const [hotPosts, setHotPosts] = useState<HotPostsState | null>(null);
  const [loadingHot, setLoadingHot] = useState(false);
  const reactingPostIds = useRef(new Set<number>());

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
      setPosts((res.posts || []).filter(isCampfirePost));
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
      setHotPosts({
        popular: isCampfirePost(res.popular) ? res.popular : null,
        most_recommended: isCampfirePost(res.most_recommended) ? res.most_recommended : null,
        most_commented: isCampfirePost(res.most_commented) ? res.most_commented : null,
        most_viewed: isCampfirePost(res.most_viewed) ? res.most_viewed : null,
        latest: isCampfirePost(res.latest) ? res.latest : null,
      });
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
    if (reactingPostIds.current.has(postId)) return;
    reactingPostIds.current.add(postId);
    try {
      const result = await reactToPost(postId, type);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? applyPostReaction(p, type, result) : p))
      );
      setHotPosts((prev) => {
        if (!prev) return prev;
        return Object.fromEntries(
          Object.entries(prev).map(([key, post]) => [
            key,
            post?.id === postId ? applyPostReaction(post, type, result) : post,
          ])
        ) as HotPostsState;
      });
    } catch (e) {
      console.error(e);
    } finally {
      reactingPostIds.current.delete(postId);
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
    <div className="min-h-screen bg-orange-50/30 text-gray-900">
      <TopActionButtons />

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="pb-10 pt-6 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            <CampfireHeroIcon />
          </div>

          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl">
            모닥불
          </h1>
          <p className="mx-auto mb-8 max-w-md text-sm leading-7 text-gray-500 sm:text-base">
            모닥불 곁에서 팀원 모집, 질문, 회고를 나눠요.
            <br />
            Campfire에서 편하게 이야기를 이어가세요.
          </p>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {SERVICE_BLOCKS.map((block) => {
              const isActive = block.path === "/community";
              return (
                <button
                  key={block.title}
                  onClick={() => router.push(block.path)}
                  className={`rounded-2xl border p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md ${
                    isActive ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ServiceIcon type={block.icon} active={isActive} />
                      <div>
                        <p className={`text-base font-bold ${isActive ? "text-orange-700" : "text-gray-900"}`}>
                          {block.title}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-400">
                          {block.subtitle}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-orange-500/20 dark:text-orange-200 dark:ring-1 dark:ring-orange-400/30">
                        현재
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500">{block.description}</p>
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
                ? "bg-orange-600 text-white shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-600 dark:shadow-none"
                : "border border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-700"
            }`}
          >
            모닥불
          </button>
          <button
            onClick={() => setTab("hot")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              tab === "hot"
                ? "bg-orange-600 text-white shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-600 dark:shadow-none"
                : "border border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-700"
            }`}
          >
            불꽃글
          </button>
        </div>

        {/* 모닥불 탭 */}
        {tab === "board" && (
          <>
            <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">모닥불</p>
                  <p className="mt-1 text-sm text-gray-500">
                    관심 있는 주제의 글을 둘러보고 모닥불 곁에서 의견을 나눠보세요.
                  </p>
                </div>
                <button
                  onClick={handleWriteClick}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-600 dark:hover:bg-slate-700"
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
                        ? "border-orange-600 bg-orange-600 text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-700"
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
                <p className="text-xs text-gray-400">모닥불의 첫 이야기를 남겨보세요</p>
                {isLoggedIn && (
                  <button
                    onClick={() => router.push("/community/new")}
                    className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-600 dark:hover:bg-slate-700"
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
              <p className="text-lg font-bold text-gray-900">불꽃글</p>
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
                        {key === "most_recommended" ? (
                          <ThumbUpIcon className="h-4 w-4 shrink-0 text-red-600" />
                        ) : (
                          <span className="text-base">{emoji}</span>
                        )}
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

function CampfireHeroIcon() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-24 w-24"
      aria-hidden
      style={{ animation: "floatCampfire 3s ease-in-out infinite" }}
    >
      <g transform="translate(-5 -5) scale(1.12)">
        <path
          d="M48 85c18-6 28-18 28-34 0-15-10-25-18-36-2 12-10 18-16 24-4-8-4-15-2-23-15 11-24 25-24 41 0 16 14 28 32 28Z"
          fill="#f97316"
        />
        <path
          d="M47 79c9-4 14-11 14-19 0-8-5-14-10-19-2 8-7 12-12 16-2 10 1 18 8 22Z"
          fill="#facc15"
        />
        <path d="M25 82l46-20" stroke="#92400e" strokeWidth="7" strokeLinecap="round" />
        <path d="M71 82L25 62" stroke="#78350f" strokeWidth="7" strokeLinecap="round" />
      </g>
      <style jsx>{`
        @keyframes floatCampfire {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.03);
          }
        }
      `}</style>
    </svg>
  );
}

function ServiceIcon({ type, active }: { type: string; active?: boolean }) {
  const muted = active ? 1 : 0.72;

  if (type === "seed") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
        <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
          <path
            d="M25 39c8-4 14-11 14-20 0-5-3-9-8-9-8 0-16 9-16 18 0 6 4 10 10 11Z"
            fill="#d97706"
            opacity={muted}
          />
          <path
            d="M16 36c5-8 11-14 19-20"
            stroke="#78350f"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.45"
          />
        </svg>
      </span>
    );
  }

  if (type === "flame") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
        <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
          <path
            d="M25 43c9-3 14-9 14-17 0-8-5-13-9-18-1 6-5 9-8 12-2-4-2-7-1-11-7 5-12 12-12 20 0 8 7 14 16 14Z"
            fill="#f97316"
            opacity={muted}
          />
          <path
            d="M24 39c4-2 7-5 7-9 0-4-2-7-5-10-1 4-4 6-6 8-1 5 0 9 4 11Z"
            fill="#facc15"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
      <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
        <path
          d="M24 40V20"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
          opacity={muted}
        />
        <path d="M23 23C13 22 9 15 9 8c8 0 15 4 16 14" fill="#22c55e" opacity={muted} />
        <path d="M25 25c10-1 15-7 15-14-8 0-15 4-16 13" fill="#16a34a" opacity={muted} />
        <path d="M15 41h18" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
