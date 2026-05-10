"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getIdeasApi, getIdeaDetailApi } from "../../../lib/api";

interface Idea {
  id: number;
  title: string;
  summary: string;
  hashtags: string[];
  like_count: number;
  bookmark_count: number;
  domain?: string;
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

const SERVICE_BLOCKS = [
  {
    title: "프로젝트 탐색",
    description: "진행 중인 아이디어와 프로젝트를 둘러보고 함께할 팀을 찾아보세요.",
    path: "/mainpage",
    isActive: false,
  },
  {
    title: "아이디어 줍기",
    description: "버려진 아이디어를 이어받아 새로운 프로젝트로 발전시켜보세요.",
    path: "/ideas/pickup",
    isActive: true,
  },
  {
    title: "자유게시판",
    description: "팀원 모집, 질문, 회고 등 자유롭게 이야기를 나눠보세요.",
    path: "/community",
    isActive: false,
  },
];

export default function InspirationWellPage() {
  const router = useRouter();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [coinModal, setCoinModal] = useState<{ open: boolean; idea: Idea | null }>({
    open: false,
    idea: null,
  });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleRef = useRef(0);

  const triggerRipple = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = rippleRef.current++;

    setRipples((prev) => [...prev, { id, x, y }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 900);
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const result = await getIdeasApi({ page: 1, size: 50, discarded: true });
        const raw: any[] = result.data || [];

        setIdeas(
          raw.map((item) => ({
            id: item.id,
            title: item.title || "제목 없음",
            summary: item.summary || item.description || "설명이 없습니다.",
            hashtags: item.hashtags || item.tech_stack || [],
            like_count: item.like_count ?? 0,
            bookmark_count: item.bookmark_count ?? 0,
            domain: item.domain || item.category || "IT/소프트웨어",
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

    const matchQ = searchQuery
      ? idea.title.includes(searchQuery) ||
        idea.summary.includes(searchQuery) ||
        idea.hashtags.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true;

    return matchCat && matchQ;
  });

  const handleServiceClick = (path: string) => {
    router.push(path);
  };

  const handleIdeaClick = (idea: Idea) => {
    setCoinModal({ open: true, idea });
  };

  const handleConfirmView = async () => {
    if (!coinModal.idea) return;

    const id = coinModal.idea.id;

    setCoinModal({ open: false, idea: null });

    try {
      await getIdeaDetailApi(id);
      router.push(`/ideas/${id}`);
    } catch {
      alert("아이디어를 불러오지 못했습니다.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f0f7ff]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 110%, #bfdfff 0%, #dbeeff 40%, #f0f7ff 100%)",
        }}
      />

      <WaterSurface />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-4">
        <button
          onClick={() => router.push("/notifications")}
          className="rounded-xl border border-blue-100 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          알림
        </button>

        <button
          onClick={() => router.push("/chat")}
          className="rounded-xl border border-blue-100 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          채팅
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20">
        <section className="pb-10 pt-6 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            <DropIcon />
          </div>

          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
            영감의 샘
          </h1>

          <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-500">
            버려진 아이디어들이 잠들어 있는 곳.
            <br />
            당신의 손길로 다시 꽃피울 씨앗을 건져보세요.
          </p>

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-4 py-1.5 text-xs font-medium text-amber-700 backdrop-blur-sm">
            <span>🪙</span>
            <span>아이디어 열람 시 코인 1개가 차감됩니다</span>
          </div>

          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {SERVICE_BLOCKS.map((block) => (
              <button
                key={block.title}
                onClick={() => handleServiceClick(block.path)}
                className={`rounded-2xl border p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md ${
                  block.isActive
                    ? "border-blue-200 bg-blue-50/80"
                    : "border-blue-100 bg-white/75"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p
                    className={`text-base font-bold ${
                      block.isActive ? "text-blue-600" : "text-slate-900"
                    }`}
                  >
                    {block.title}
                  </p>

                  {block.isActive && (
                    <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      현재
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-slate-500">
                  {block.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-blue-100 bg-white/75 p-5 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-slate-800">영감의 샘</p>
              <p className="mt-1 text-sm text-slate-500">
                잠들어 있는 아이디어를 다시 프로젝트로 발전시켜보세요.
              </p>
            </div>

            <button
              onClick={() => alert("아이디어를 클릭하면 코인 1개를 사용해 상세 내용을 확인할 수 있어요. 마음에 드는 아이디어를 발견했다면 건져보기로 이어받아보세요.")}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              아이디어 줍기 가이드
            </button>
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="아이디어 제목, 태그로 검색해보세요"
            className="mb-4 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400"
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedCategory === cat.label
                    ? "border-blue-500 bg-blue-500 text-white shadow-sm shadow-blue-200"
                    : "border-blue-100 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              {searchQuery || selectedCategory !== "전체"
                ? `검색 결과 (${filtered.length})`
                : `${filtered.length}개의 아이디어가 잠들어 있어요`}
            </p>

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

          {loading ? (
            <LoadingWater />
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
                    triggerRipple(e);
                    handleIdeaClick(idea);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {coinModal.open && coinModal.idea && (
        <CoinModal
          idea={coinModal.idea}
          onConfirm={handleConfirmView}
          onCancel={() => setCoinModal({ open: false, idea: null })}
        />
      )}

      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute block rounded-full border border-blue-300/40 animate-[ripple_0.9s_ease-out_forwards]"
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
        @keyframes ripple {
          to {
            transform: scale(20);
            opacity: 0;
          }
        }

        @keyframes floatDrop {
          0%,
          100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.03);
          }
        }

        @keyframes waveSlow {
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

function WaterSurface() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 overflow-hidden"
      style={{ height: "320px" }}
    >
      <svg
        viewBox="0 0 1440 120"
        className="absolute bottom-16 w-[200%]"
        style={{ animation: "waveSlow 14s linear infinite" }}
        preserveAspectRatio="none"
      >
        <path
          d="M0,60 C240,90 480,30 720,60 C960,90 1200,30 1440,60 L1440,120 L0,120 Z"
          fill="rgba(186,222,255,0.35)"
        />
      </svg>

      <svg
        viewBox="0 0 1440 120"
        className="absolute bottom-0 w-[200%]"
        style={{ animation: "waveSlow 9s linear infinite reverse" }}
        preserveAspectRatio="none"
      >
        <path
          d="M0,40 C360,80 720,10 1080,50 C1260,70 1380,30 1440,40 L1440,120 L0,120 Z"
          fill="rgba(147,200,255,0.45)"
        />
      </svg>
    </div>
  );
}

function DropIcon() {
  return (
    <svg
      viewBox="0 0 80 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "floatDrop 3s ease-in-out infinite" }}
    >
      <defs>
        <radialGradient id="dropGrad" cx="40%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#e0f2ff" />
          <stop offset="60%" stopColor="#60aef0" />
          <stop offset="100%" stopColor="#1d72c8" />
        </radialGradient>

        <radialGradient id="gloss" cx="35%" cy="25%" r="45%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <path
        d="M40 4 C40 4 8 44 8 62 C8 79.7 22.3 92 40 92 C57.7 92 72 79.7 72 62 C72 44 40 4 40 4Z"
        fill="url(#dropGrad)"
      />

      <path
        d="M40 4 C40 4 8 44 8 62 C8 79.7 22.3 92 40 92 C57.7 92 72 79.7 72 62 C72 44 40 4 40 4Z"
        fill="url(#gloss)"
      />

      <ellipse cx="30" cy="44" rx="7" ry="11" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

function LoadingWater() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 w-3 rounded-full bg-blue-300"
            style={{
              animation: `floatDrop 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="text-sm text-slate-400">샘에서 아이디어를 건져오는 중...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl opacity-50">🪣</div>
      <p className="text-sm font-medium text-slate-500">샘이 비어있어요</p>
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
}: {
  idea: Idea;
  index: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-fadeup group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white/80 p-5 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 120%, #dbeeff 0%, transparent 70%)",
        }}
      />

      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600">
          {idea.domain || "기타"}
        </span>

        <FishingBobber />
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

      <div className="mt-auto flex items-center justify-between border-t border-blue-50 pt-3">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>❤️ {idea.like_count}</span>
          <span>🔖 {idea.bookmark_count}</span>
        </div>

        <span className="rounded-lg bg-blue-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 transition group-hover:bg-blue-600">
          건져보기 🪝
        </span>
      </div>
    </button>
  );
}

function FishingBobber() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="opacity-40 transition-opacity group-hover:opacity-70"
    >
      <circle cx="12" cy="14" r="6" fill="#60aef0" />
      <rect x="11.5" y="2" width="1" height="8" rx="0.5" fill="#94a3b8" />
      <circle cx="12" cy="2" r="1.5" fill="#f87171" />
    </svg>
  );
}

function CoinModal({
  idea,
  onConfirm,
  onCancel,
}: {
  idea: Idea;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-sm rounded-3xl border border-blue-100 bg-white p-7 shadow-2xl shadow-blue-200/40">
        <div className="mx-auto mb-4 h-14 w-14">
          <DropIcon />
        </div>

        <h2 className="mb-1 text-center text-base font-bold text-slate-800">
          아이디어를 건져올까요?
        </h2>

        <p className="mb-1 line-clamp-1 text-center text-sm font-semibold text-slate-700">
          "{idea.title}"
        </p>

        <p className="mb-5 text-center text-xs text-slate-400">
          이 아이디어를 열람하면{" "}
          <span className="font-semibold text-amber-600">코인 1개</span>가
          차감됩니다.
        </p>

        <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 py-3">
          <span className="text-xl">🪙</span>
          <span className="text-sm font-semibold text-amber-700">
            −1 코인 차감
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
          >
            취소
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-600"
          >
            건져보기 🪝
          </button>
        </div>
      </div>
    </div>
  );
}