"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getIdeasApi, getIdeaDetailApi } from "../../../lib/api";

// ─── 타입 ────────────────────────────────────────────────────────────────────
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

// ─── 상수 ────────────────────────────────────────────────────────────────────
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

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
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
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 900);
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
        idea.hashtags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchCat && matchQ;
  });

  const handleIdeaClick = (idea: Idea) => {
    setCoinModal({ open: true, idea });
  };

  const handleConfirmView = async () => {
    if (!coinModal.idea) return;
    const id = coinModal.idea.id;
    setCoinModal({ open: false, idea: null });
    try {
      // GET /ideas/{idea_id} 호출 시 1코인 차감됨
      await getIdeaDetailApi(id);
      router.push(`/ideas/${id}`);
    } catch {
      alert("아이디어를 불러오지 못했습니다.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f0f7ff]">
      {/* 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 110%, #bfdfff 0%, #dbeeff 40%, #f0f7ff 100%)",
        }}
      />
      <WaterSurface />

      {/* 헤더 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <button
          onClick={() => router.push("/mainpage")}
          className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          ← 돌아가기
        </button>
        <div className="flex gap-2">
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
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative z-10 px-6 pb-8 pt-2 text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
          <DropIcon />
        </div>
        <h1
          style={{
            fontFamily: "inherit",
            fontSize: "2.2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#1e293b",
            marginBottom: "8px",
          }}
        >
          영감의 샘
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>
          버려진 아이디어들이 잠들어 있는 곳.<br />
          당신의 손길로 다시 꽃피울 씨앗을 건져보세요.
        </p>
        {/* 코인 배지 */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "14px",
            marginBottom: "20px",
            padding: "6px 16px",
            borderRadius: "20px",
            border: "1px solid rgba(202, 150, 30, 0.35)",
            background: "rgba(255, 243, 200, 0.55)",
            fontSize: "12px",
            fontWeight: 500,
            color: "#92650a",
            backdropFilter: "blur(4px)",
          }}
        >
          <span>🪙</span> 아이디어 열람 시 코인 1개가 차감됩니다
        </div>
      </section>

      {/* 검색 + 필터 */}
      <div className="relative z-10 mx-auto max-w-4xl px-4">
        {/* 검색창 */}
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "14px",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="아이디어 제목, 태그로 검색해보세요"
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "16px",
              border: "1px solid rgba(100, 165, 230, 0.45)",
              background: "rgba(255, 255, 255, 0.72)",
              backdropFilter: "blur(8px)",
              padding: "11px 16px 11px 40px",
              fontSize: "13px",
              color: "#334155",
              outline: "none",
              boxShadow: "0 1px 4px rgba(100,160,230,0.08)",
            }}
          />
        </div>

        {/* 카테고리 필터 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setSelectedCategory(cat.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                borderRadius: "20px",
                padding: "5px 13px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
                border: selectedCategory === cat.label
                  ? "1px solid #378add"
                  : "1px solid rgba(100, 165, 230, 0.4)",
                background: selectedCategory === cat.label
                  ? "#378add"
                  : "rgba(255, 255, 255, 0.65)",
                color: selectedCategory === cat.label
                  ? "#ffffff"
                  : "#475569",
                backdropFilter: "blur(4px)",
                boxShadow: selectedCategory === cat.label
                  ? "0 2px 8px rgba(55,138,221,0.25)"
                  : "none",
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 아이디어 목록 */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20">

        <div className="mt-1 mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">
            {filtered.length}개의 아이디어가 잠들어 있어요
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              초기화
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
                  triggerRipple(e as any);
                  handleIdeaClick(idea);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* 코인 확인 모달 */}
      {coinModal.open && coinModal.idea && (
        <CoinModal
          idea={coinModal.idea}
          onConfirm={handleConfirmView}
          onCancel={() => setCoinModal({ open: false, idea: null })}
        />
      )}

      {/* Ripple 레이어 */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute block rounded-full border border-blue-300/40 animate-[ripple_0.9s_ease-out_forwards]"
            style={{ left: r.x - 10, top: r.y - 10, width: 20, height: 20 }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes ripple {
          to { transform: scale(20); opacity: 0; }
        }
        @keyframes floatDrop {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-8px) scale(1.03); }
        }
        @keyframes waveSlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-fadeup {
          animation: fadeUp 0.4s ease both;
        }
      `}</style>
    </div>
  );
}

// ─── 물 배경 ──────────────────────────────────────────────────────────────────
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

// ─── 물방울 아이콘 ─────────────────────────────────────────────────────────────
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

// ─── 물결 구분선 ──────────────────────────────────────────────────────────────
function WaveDivider() {
  return (
    <svg viewBox="0 0 600 20" className="mb-2 w-full opacity-40" preserveAspectRatio="none">
      <path
        d="M0,10 C100,18 200,2 300,10 C400,18 500,2 600,10"
        stroke="#60aef0"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── 로딩 ─────────────────────────────────────────────────────────────────────
function LoadingWater() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 w-3 rounded-full bg-blue-300"
            style={{ animation: `floatDrop 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <p className="text-sm text-slate-400">샘에서 아이디어를 건져오는 중...</p>
    </div>
  );
}

// ─── 빈 상태 ──────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl opacity-50">🪣</div>
      <p className="text-sm font-medium text-slate-500">샘이 비어있어요</p>
      <p className="mt-1 text-xs text-slate-400">아직 버려진 아이디어가 없습니다.</p>
    </div>
  );
}

// ─── 아이디어 카드 ────────────────────────────────────────────────────────────
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
      className="card-fadeup group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60 text-left"
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

// ─── 낚시찌 ───────────────────────────────────────────────────────────────────
function FishingBobber() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="opacity-40 group-hover:opacity-70 transition-opacity"
    >
      <circle cx="12" cy="14" r="6" fill="#60aef0" />
      <rect x="11.5" y="2" width="1" height="8" rx="0.5" fill="#94a3b8" />
      <circle cx="12" cy="2" r="1.5" fill="#f87171" />
    </svg>
  );
}

// ─── 코인 확인 모달 ────────────────────────────────────────────────────────────
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
        <p className="mb-1 text-center text-sm font-semibold text-slate-700 line-clamp-1">
          "{idea.title}"
        </p>
        <p className="mb-5 text-center text-xs text-slate-400">
          이 아이디어를 열람하면{" "}
          <span className="font-semibold text-amber-600">코인 1개</span>가 차감됩니다.
        </p>
        <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 py-3">
          <span className="text-xl">🪙</span>
          <span className="text-sm font-semibold text-amber-700">−1 코인 차감</span>
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
