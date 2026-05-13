"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  bookmarkIdeaApi,
  getIdeasApi,
  getMyCoinBalanceApi,
  likeIdeaApi,
  unbookmarkIdeaApi,
  unlikeIdeaApi,
} from "../../../lib/api";
import { getToken } from "../../../lib/auth";

interface Idea {
  id: number;
  title: string;
  summary: string;
  hashtags: string[];
  like_count: number;
  bookmark_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  domain?: string;
  difficulty?: string;
  created_at?: string;
}

interface IdeaListItem {
  id: number;
  title?: string;
  summary?: string;
  description?: string;
  hashtags?: string[];
  tech_stack?: string[];
  like_count?: number;
  bookmark_count?: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  domain?: string;
  category?: string;
  difficulty?: string;
  created_at?: string;
}

const CATEGORIES = [
  { label: "전체", emoji: "✨" },
  { label: "IT/소프트웨어", emoji: "💻" },
  { label: "경영/경제", emoji: "📊" },
  { label: "디자인/UI·UX", emoji: "🎨" },
  { label: "AI/데이터", emoji: "🤖" },
  { label: "교육/학습", emoji: "📚" },
  { label: "금융/핀테크", emoji: "💳" },
  { label: "커머스/쇼핑", emoji: "🛒" },
  { label: "소셜/커뮤니티", emoji: "💬" },
  { label: "헬스케어", emoji: "❤️" },
];

const IDEA_VIEW_COIN_COST = 1;

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
    isActive: true,
  },
  {
    title: "모닥불",
    subtitle: "Campfire",
    description: "팀원 모집, 질문, 회고를 불빛 곁에서 \n편하게 나눠보세요.",
    path: "/community",
    icon: "flame",
    isActive: false,
  },
];

export default function InspirationWellPage() {
  const router = useRouter();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "liked" | "bookmarked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [coinModal, setCoinModal] = useState<{ open: boolean; idea: Idea | null }>({
    open: false,
    idea: null,
  });
  const [pickingUp, setPickingUp] = useState(false);
  const [seedBursts, setSeedBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const seedBurstRef = useRef(0);

  const triggerSeedBurst = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = seedBurstRef.current++;

    setSeedBursts((prev) => [...prev, { id, x, y }]);

    setTimeout(() => {
      setSeedBursts((prev) => prev.filter((r) => r.id !== id));
    }, 900);
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [result, coinResult] = await Promise.all([
          getIdeasApi({ page: 1, size: 50, discarded: true }),
          getToken()
            ? getMyCoinBalanceApi().catch(() => null)
            : Promise.resolve(null),
        ]);
        const raw: IdeaListItem[] = result.data || [];

        setCoinBalance(coinResult?.data?.coin_balance ?? null);
        setIdeas(
          raw.map((item) => ({
            id: item.id,
            title: item.title || "제목 없음",
            summary: item.summary || item.description || "설명이 없습니다.",
            hashtags: item.hashtags || item.tech_stack || [],
            like_count: item.like_count ?? 0,
            bookmark_count: item.bookmark_count ?? 0,
            is_liked: Boolean(item.is_liked),
            is_bookmarked: Boolean(item.is_bookmarked),
            domain: item.domain || item.category || "IT/소프트웨어",
            difficulty: item.difficulty,
            created_at: item.created_at,
          }))
        );
      } catch {
        setIdeas([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = ideas.filter((idea) => {
    const matchCat =
      selectedCategory === "전체" ? true : idea.domain === selectedCategory;
    const matchCollection =
      collectionFilter === "liked"
        ? idea.is_liked
        : collectionFilter === "bookmarked"
          ? idea.is_bookmarked
          : true;

    const matchQ = searchQuery
      ? idea.title.includes(searchQuery) ||
        idea.summary.includes(searchQuery) ||
        idea.hashtags.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true;

    return matchCat && matchCollection && matchQ;
  });

  const likedCount = ideas.filter((idea) => idea.is_liked).length;
  const bookmarkedCount = ideas.filter((idea) => idea.is_bookmarked).length;

  const handleServiceClick = (path: string) => {
    router.push(path);
  };

  const handleIdeaClick = (idea: Idea) => {
    setCoinModal({ open: true, idea });
  };

  const updateIdeaReaction = (
    ideaId: number,
    updater: (idea: Idea) => Idea
  ) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === ideaId ? updater(idea) : idea)));
  };

  const handleToggleLike = async (idea: Idea) => {
    if (!getToken()) {
      alert("로그인 후 좋아요를 누를 수 있어요.");
      return;
    }

    const nextLiked = !idea.is_liked;
    updateIdeaReaction(idea.id, (current) => ({
      ...current,
      is_liked: nextLiked,
      like_count: Math.max(0, current.like_count + (nextLiked ? 1 : -1)),
    }));

    try {
      if (nextLiked) {
        await likeIdeaApi(idea.id);
      } else {
        await unlikeIdeaApi(idea.id);
      }
    } catch (error) {
      updateIdeaReaction(idea.id, (current) => ({
        ...current,
        is_liked: idea.is_liked,
        like_count: idea.like_count,
      }));
      alert(error instanceof Error ? error.message : "좋아요 처리에 실패했습니다.");
    }
  };

  const handleToggleBookmark = async (idea: Idea) => {
    if (!getToken()) {
      alert("로그인 후 북마크할 수 있어요.");
      return;
    }

    const nextBookmarked = !idea.is_bookmarked;
    updateIdeaReaction(idea.id, (current) => ({
      ...current,
      is_bookmarked: nextBookmarked,
      bookmark_count: Math.max(0, current.bookmark_count + (nextBookmarked ? 1 : -1)),
    }));

    try {
      if (nextBookmarked) {
        await bookmarkIdeaApi(idea.id);
      } else {
        await unbookmarkIdeaApi(idea.id);
      }
    } catch (error) {
      updateIdeaReaction(idea.id, (current) => ({
        ...current,
        is_bookmarked: idea.is_bookmarked,
        bookmark_count: idea.bookmark_count,
      }));
      alert(error instanceof Error ? error.message : "북마크 처리에 실패했습니다.");
    }
  };

  const handleConfirmView = async () => {
    if (!coinModal.idea) return;

    const id = coinModal.idea.id;

    try {
      setPickingUp(true);
      setCoinModal({ open: false, idea: null });
      router.push(`/ideas/pickup/${id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "아이디어를 열람하지 못했습니다.");
    } finally {
      setPickingUp(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f7fbf3] text-slate-900"
      style={{ colorScheme: "light" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 110%, #d9f99d 0%, #ecfccb 38%, #f7fbf3 100%)",
        }}
      />

      <GardenGround />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-4">
        <button
          onClick={() => router.push("/notifications")}
          className="rounded-xl border border-emerald-100 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-emerald-700"
        >
          알림
        </button>

        <button
          onClick={() => router.push("/chat")}
          className="rounded-xl border border-emerald-100 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-emerald-700"
        >
          채팅
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20">
        <section className="pb-10 pt-6 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            <SeedIcon />
          </div>

          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-slate-800 sm:text-4xl">
            생각의 뜰
          </h1>

          <p className="mx-auto mb-8 max-w-md text-sm leading-7 text-slate-500 sm:text-base">
            버려진 아이디어들이 잠들어 있는 곳.
            <br />
            당신의 손길로 다시 꽃피울 씨앗을 살펴보세요.
          </p>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {SERVICE_BLOCKS.map((block) => (
              <button
                key={block.title}
                onClick={() => handleServiceClick(block.path)}
                className={`rounded-2xl border p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md ${
                  block.isActive
                    ? "border-emerald-200 bg-emerald-50/80"
                    : "border-emerald-100 bg-white/75"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ServiceIcon type={block.icon} active={block.isActive} />
                    <div>
                      <p
                        className={`text-base font-bold ${
                          block.isActive ? "text-emerald-700" : "text-slate-900"
                        }`}
                      >
                        {block.title}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {block.subtitle}
                      </p>
                    </div>
                  </div>

                  {block.isActive && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      현재
                    </span>
                  )}
                </div>

                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500">
                  {block.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-emerald-100 bg-white/75 p-5 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-slate-800">생각의 뜰</p>
              <p className="mt-1 text-sm text-slate-500">
                잠들어 있는 아이디어를 열람한 뒤 프로젝트로 이어받아보세요.
              </p>
            </div>

            <button
              onClick={() => alert("아이디어를 클릭하면 코인 1개를 사용해 상세 내용을 확인할 수 있어요. 마음에 들면 상세 페이지에서 내 프로젝트로 만들 수 있습니다.")}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              생각의 뜰 가이드
            </button>
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="아이디어 제목, 태그로 검색해보세요"
            className="mb-4 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedCategory === cat.label
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                    : "border-emerald-100 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-600">
                {searchQuery || selectedCategory !== "전체"
                  ? `검색 결과 (${filtered.length})`
                  : `${filtered.length}개의 아이디어가 잠들어 있어요`}
              </p>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-700">
                <span>🪙</span>
                <span>아이디어 열람 시 코인 1개가 차감됩니다</span>
              </span>
            </div>

            {(searchQuery || selectedCategory !== "전체") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("전체");
                }}
                className="text-xs text-slate-400 transition hover:text-slate-600"
              >
                필터 초기화
              </button>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { value: "all", label: "전체", count: ideas.length },
              { value: "liked", label: "좋아요", count: likedCount },
              { value: "bookmarked", label: "북마크", count: bookmarkedCount },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setCollectionFilter(filter.value as "all" | "liked" | "bookmarked")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  collectionFilter === filter.value
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-100"
                    : "border-emerald-100 bg-white/80 text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                {filter.label} {filter.count}
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingGarden />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((idea, i) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  index={i}
                  onClick={(e) => {
                    triggerSeedBurst(e);
                    handleIdeaClick(idea);
                  }}
                  onToggleLike={handleToggleLike}
                  onToggleBookmark={handleToggleBookmark}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {coinModal.open && coinModal.idea && (
        <CoinModal
          idea={coinModal.idea}
          coinBalance={coinBalance}
          coinCost={IDEA_VIEW_COIN_COST}
          onConfirm={handleConfirmView}
          onCancel={() => setCoinModal({ open: false, idea: null })}
          isLoading={pickingUp}
        />
      )}

      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {seedBursts.map((r) => (
          <span
            key={r.id}
            className="absolute block rounded-full border border-emerald-300/50 animate-[seedBurst_0.9s_ease-out_forwards]"
            style={{
              left: r.x - 10,
              top: r.y - 10,
              width: 20,
              height: 20,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes seedBurst {
          to {
            transform: scale(12);
            opacity: 0;
          }
        }

        @keyframes floatSeed {
          0%,
          100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.03);
          }
        }

        @keyframes gardenDrift {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .card-fadeup {
          animation: fadeUp 0.4s ease both;
        }
      `}</style>
    </div>
  );
}

function GardenGround() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 overflow-hidden"
      style={{ height: "260px" }}
    >
      <svg
        viewBox="0 0 1440 120"
        className="absolute bottom-12 w-[200%]"
        style={{ animation: "gardenDrift 18s linear infinite" }}
        preserveAspectRatio="none"
      >
        <path
          d="M0,72 C240,42 480,96 720,66 C960,36 1200,92 1440,58 L1440,120 L0,120 Z"
          fill="rgba(190,242,100,0.28)"
        />
      </svg>

      <svg
        viewBox="0 0 1440 120"
        className="absolute bottom-0 w-[200%]"
        style={{ animation: "gardenDrift 13s linear infinite reverse" }}
        preserveAspectRatio="none"
      >
        <path
          d="M0,52 C300,88 620,24 960,58 C1180,82 1320,40 1440,52 L1440,120 L0,120 Z"
          fill="rgba(134,239,172,0.38)"
        />
      </svg>
    </div>
  );
}

function SeedIcon() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "floatSeed 3s ease-in-out infinite" }}
    >
      <defs>
        <radialGradient id="seedGrad" cx="36%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="58%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
      </defs>
      <path
        d="M51 83c19-9 31-26 31-45 0-12-7-22-19-22-22 0-43 22-43 44 0 14 10 23 31 23Z"
        fill="url(#seedGrad)"
      />
      <path
        d="M24 76c11-22 27-39 48-54"
        stroke="#78350f"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M38 32c-7-13-19-17-30-16 2 11 10 21 28 22"
        fill="#22c55e"
      />
    </svg>
  );
}

function LoadingGarden() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 w-3 rounded-full bg-emerald-300"
            style={{
              animation: `floatSeed 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="text-sm text-slate-400">뜰에서 아이디어 씨앗을 살펴보는 중...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl opacity-60">🌱</div>
      <p className="text-sm font-medium text-slate-500">뜰이 비어있어요</p>
      <p className="mt-1 text-xs text-slate-400">
        아직 버려진 아이디어가 없습니다.
      </p>
    </div>
  );
}

function IdeaCard({
  idea,
  index,
  onClick,
  onToggleLike,
  onToggleBookmark,
}: {
  idea: Idea;
  index: number;
  onClick: (e: React.MouseEvent) => void;
  onToggleLike: (idea: Idea) => void;
  onToggleBookmark: (idea: Idea) => void;
}) {
  return (
    <article
      onClick={onClick}
      className="card-fadeup group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white/80 p-5 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/60"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 120%, #dcfce7 0%, transparent 70%)",
        }}
      />

      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
          {idea.domain || "기타"}
        </span>

        <SeedMark />
      </div>

      <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-slate-800">
        {idea.title}
      </h3>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
        {idea.summary}
      </p>

      {idea.hashtags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {idea.hashtags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-emerald-50 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(idea);
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              idea.is_liked
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-100 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-500"
            }`}
            aria-label={idea.is_liked ? "좋아요 취소" : "좋아요"}
          >
            ♥ {idea.like_count}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(idea);
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              idea.is_bookmarked
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-slate-100 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-500"
            }`}
            aria-label={idea.is_bookmarked ? "북마크 해제" : "북마크"}
          >
            ★ {idea.bookmark_count}
          </button>
        </div>

        <span className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm shadow-emerald-200 transition group-hover:bg-emerald-700">
          살펴보기
        </span>
      </div>
    </article>
  );
}

function SeedMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="opacity-40 transition-opacity group-hover:opacity-70"
    >
      <path
        d="M13 21c5-3 8-7 8-12 0-3-2-5-5-5-6 0-11 6-11 11 0 4 3 6 8 6Z"
        fill="#d97706"
      />
      <path d="M6 20c3-6 7-10 13-15" stroke="#78350f" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
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
          <path d="M16 36c5-8 11-14 19-20" stroke="#78350f" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.45" />
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
          <path d="M24 39c4-2 7-5 7-9 0-4-2-7-5-10-1 4-4 6-6 8-1 5 0 9 4 11Z" fill="#facc15" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
      <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
        <path d="M24 40V20" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" opacity={muted} />
        <path d="M23 23C13 22 9 15 9 8c8 0 15 4 16 14" fill="#22c55e" opacity={muted} />
        <path d="M25 25c10-1 15-7 15-14-8 0-15 4-16 13" fill="#16a34a" opacity={muted} />
        <path d="M15 41h18" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function CoinModal({
  idea,
  coinBalance,
  coinCost,
  onConfirm,
  onCancel,
  isLoading,
}: {
  idea: Idea;
  coinBalance: number | null;
  coinCost: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const remainingBalance = coinBalance === null ? null : coinBalance - coinCost;
  const isInsufficient = coinBalance !== null && coinBalance < coinCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-sm rounded-3xl border border-emerald-100 bg-white p-7 shadow-2xl shadow-emerald-200/40">
        <div className="mx-auto mb-4 h-14 w-14">
          <SeedIcon />
        </div>

        <h2 className="mb-1 text-center text-base font-bold text-slate-800">
          아이디어를 열람할까요?
        </h2>

        <p className="mb-1 line-clamp-1 text-center text-sm font-semibold text-slate-700">
          &ldquo;{idea.title}&rdquo;
        </p>

        <p className="mb-5 text-center text-xs text-slate-400">
          이 아이디어를 열람하면{" "}
          <span className="font-semibold text-amber-600">코인 {coinCost}개</span>가
          차감됩니다.
        </p>

        <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-amber-100 bg-amber-50 text-center">
          <div className="px-3 py-3">
            <p className="text-[11px] font-semibold text-amber-700/70">
              현재 잔액
            </p>
            <p className="mt-1 text-base font-black text-amber-800">
              {coinBalance === null ? "-" : coinBalance.toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="border-x border-amber-100 bg-white/70 px-3 py-3">
            <p className="text-[11px] font-semibold text-amber-700/70">
              사용량
            </p>
            <p className="mt-1 text-base font-black text-red-600">
              -{coinCost.toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="px-3 py-3">
            <p className="text-[11px] font-semibold text-amber-700/70">
              사용 후
            </p>
            <p className={`mt-1 text-base font-black ${isInsufficient ? "text-red-600" : "text-amber-800"}`}>
              {remainingBalance === null ? "-" : remainingBalance.toLocaleString("ko-KR")}
            </p>
          </div>
        </div>

        {isInsufficient ? (
          <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700">
            코인이 부족합니다. 코인을 충전한 뒤 다시 열람해주세요.
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
          >
            취소
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading || isInsufficient}
            className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isLoading ? "여는 중..." : isInsufficient ? "코인 부족" : "열람하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
