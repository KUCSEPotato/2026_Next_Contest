"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_CHANGED_EVENT, getToken } from "../../lib/auth";
import { getProjectsApi, getRecommendedProjectsApi } from "../../lib/api";

interface Project {
  id: number;
  project_id?: number | null;
  converted_to_project_id?: number | null;
  title: string;
  description: string;
  summary?: string;
  category: string;
  techStack: string[];
  hashtags: string[];
  currentMembers: number;
  maxMembers: number;
  status: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  isUrgent: boolean;
  applicantCount: number;
  remainingSeats: number;
  competitionRatio: number;
  openRecruitmentCount: number;
  openRecruitmentRequiredCount: number;
  openRecruitmentPosition?: string | null;
  createdAt: string;
}

interface ApiProject {
  id: number;
  title?: string;
  description?: string;
  summary?: string;
  category?: string;
  tech_stack?: string[];
  techStack?: string[];
  hashtags?: string[];
  hashTags?: string[];
  hash_tags?: string[];
  tags?: string[];
  currentMembers?: number;
  current_members?: number;
  maxMembers?: number;
  max_members?: number;
  applicantCount?: number;
  applicant_count?: number;
  remainingSeats?: number;
  remaining_seats?: number;
  competitionRatio?: number;
  competition_ratio?: number;
  openRecruitmentCount?: number;
  open_recruitment_count?: number;
  openRecruitmentRequiredCount?: number;
  open_recruitment_required_count?: number;
  openRecruitmentPosition?: string | null;
  open_recruitment_position?: string | null;
  created_at?: string;
  createdAt?: string;
  status?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

interface RecommendedProject {
  project_id?: number;
  id?: number;
}

const CATEGORIES = [
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

const DIFFICULTY_LABEL = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "고급",
};

const DIFFICULTY_COLOR = {
  beginner: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-400/30",
  intermediate: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-1 dark:ring-amber-400/30",
  advanced: "text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-1 dark:ring-rose-400/30",
};

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
];

const RECRUITMENT_STATUS_OPTIONS = [
  { value: "recruiting", label: "모집중" },
  { value: "closed", label: "모집완료" },
];

const SORT_OPTIONS = [
  { value: "latest", label: "최신순" },
  { value: "recommended", label: "추천순" },
  { value: "competition", label: "경쟁률순" },
];

const SERVICE_BLOCKS = [
  {
    title: "개발의 땅",
    subtitle: "Devory",
    description: "진행 중인 프로젝트가 자라는 땅에서\n 함께할 팀을 찾아보세요.",
    path: "/mainpage",
    icon: "sprout",
    isActive: true,
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
    isActive: false,
  },
];

const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const syncAuthState = () => setIsLoggedIn(!!getToken());

    syncAuthState();
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  return { isLoggedIn };
};

function normalizeProject(project: ApiProject): Project {
  return {
    id: project.id,
    project_id: project.id,
    converted_to_project_id: project.id,
    title: project.title || "제목 없음",
    description: project.summary || project.description || "설명이 없습니다.",
    summary: project.summary,
    category: project.category || "IT/소프트웨어",
    techStack: project.techStack || project.tech_stack || [],
    hashtags: project.hashtags || project.hashTags || project.hash_tags || project.tags || [],
    currentMembers: project.currentMembers ?? project.current_members ?? 0,
    maxMembers: project.maxMembers ?? project.max_members ?? 0,
    applicantCount: project.applicantCount ?? project.applicant_count ?? 0,
    remainingSeats: project.remainingSeats ?? project.remaining_seats ?? 0,
    competitionRatio: project.competitionRatio ?? project.competition_ratio ?? 0,
    openRecruitmentCount: project.openRecruitmentCount ?? project.open_recruitment_count ?? 0,
    openRecruitmentRequiredCount:
      project.openRecruitmentRequiredCount ?? project.open_recruitment_required_count ?? 0,
    openRecruitmentPosition:
      project.openRecruitmentPosition ?? project.open_recruitment_position ?? null,
    status: project.status || "planning",
    difficulty: project.difficulty ?? "beginner",
    isUrgent: false,
    createdAt: project.createdAt ?? project.created_at ?? "",
  };
}

function isProjectRecruiting(project: Project) {
  if (project.openRecruitmentCount > 0) return true;

  return (
    project.status !== "in_progress" &&
    project.status !== "completed" &&
    (!project.maxMembers || project.currentMembers < project.maxMembers)
  );
}

export default function MainPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedRecruitmentStatus, setSelectedRecruitmentStatus] = useState<string | null>(null);
  const [memberMin, setMemberMin] = useState("");
  const [memberMax, setMemberMax] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [recommendedProjectIds, setRecommendedProjectIds] = useState<number[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        setLoadError("");

        const result = await getProjectsApi({ page: 1, size: 100 });
        const projects = result.data || [];

        setProjects(projects.map(normalizeProject));
      } catch (error) {
        console.error("프로젝트 목록 조회 실패:", error);
        setLoadError("프로젝트 목록을 불러오지 못했습니다.");
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  useEffect(() => {
    async function loadRecommendedProjectOrder() {
      if (sortBy !== "recommended") return;

      if (!isLoggedIn) {
        setRecommendedProjectIds([]);
        return;
      }

      try {
        const result = await getRecommendedProjectsApi({}, 100);
        const recommendations: RecommendedProject[] = result.data || [];
        setRecommendedProjectIds(
          recommendations
            .map((project) => project.project_id ?? project.id)
            .filter((id): id is number => typeof id === "number")
        );
      } catch (error) {
        console.error("추천 프로젝트 조회 실패:", error);
        setRecommendedProjectIds([]);
      }
    }

    loadRecommendedProjectOrder();
  }, [isLoggedIn, sortBy]);

  const handleProtectedAction = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return false;
    }
    return true;
  };

  const handleServiceClick = (path: string) => {
    if (path === "/mainpage") {
      router.push(path);
      return;
    }

    router.push(path);
  };

  const handleProjectClick = (project: Project) => {
    if (!handleProtectedAction()) return;

    const projectId = project.project_id || project.converted_to_project_id || project.id;

    if (projectId) {
      router.push(`/projects/${projectId}`, { scroll: true });
    } else {
      alert("연결된 프로젝트가 없습니다.");
    }
  };

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const minMembers = memberMin ? Number(memberMin) : null;
    const maxMembers = memberMax ? Number(memberMax) : null;
    const recommendationRank = new Map(
      recommendedProjectIds.map((projectId, index) => [projectId, index])
    );

    return projects
      .filter((project) => {
        const matchCategory = selectedCategory
          ? project.category === selectedCategory
          : true;

        const matchDifficulty = selectedDifficulty
          ? project.difficulty === selectedDifficulty
          : true;

        const recruiting = isProjectRecruiting(project);
        const matchRecruitmentStatus =
          selectedRecruitmentStatus === "recruiting"
            ? recruiting
            : selectedRecruitmentStatus === "closed"
            ? !recruiting
            : true;

        const memberCount = project.maxMembers || project.currentMembers;
        const matchMemberMin = minMembers === null || memberCount >= minMembers;
        const matchMemberMax = maxMembers === null || memberCount <= maxMembers;

        const matchSearch = query
          ? project.title.toLowerCase().includes(query) ||
            project.description.toLowerCase().includes(query) ||
            project.techStack.some((tech) =>
              tech.toLowerCase().includes(query)
            ) ||
            project.hashtags.some((tag) =>
              tag.toLowerCase().includes(query.replace(/^#/, ""))
            )
          : true;

        return (
          matchCategory &&
          matchDifficulty &&
          matchRecruitmentStatus &&
          matchMemberMin &&
          matchMemberMax &&
          matchSearch
        );
      })
      .sort((a, b) => {
        if (sortBy === "competition") {
          return b.competitionRatio - a.competitionRatio;
        }

        if (sortBy === "recommended") {
          const aRank = recommendationRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bRank = recommendationRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;

          if (aRank !== bRank) return aRank - bRank;
        }

        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
  }, [
    memberMax,
    memberMin,
    projects,
    recommendedProjectIds,
    searchQuery,
    selectedCategory,
    selectedDifficulty,
    selectedRecruitmentStatus,
    sortBy,
  ]);

  const hasActiveFilters =
    searchQuery ||
    selectedCategory ||
    selectedDifficulty ||
    selectedRecruitmentStatus ||
    memberMin ||
    memberMax ||
    sortBy !== "latest";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-4">
        <button
          onClick={() => router.push("/notices")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-400/60 dark:hover:text-red-300"
        >
          공지
        </button>

        <button
          onClick={() => router.push("/notifications")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-400/60 dark:hover:text-red-300"
        >
          알림
        </button>

        <button
          onClick={() => router.push("/chat")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-400/60 dark:hover:text-red-300"
        >
          채팅
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="pb-10 pt-6 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            <SproutHeroIcon />
          </div>

          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-slate-50 sm:text-4xl">
            개발의 땅
          </h1>

          <p className="mx-auto mb-8 max-w-md text-sm leading-7 text-gray-500 dark:text-slate-400 sm:text-base">
            아이디어가 팀이 되고, 팀이 프로젝트로 자라는 곳.
            <br />
            Devory에서 함께할 팀을 찾아보세요.
          </p>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {SERVICE_BLOCKS.map((block) => (
              <button
                key={block.title}
                onClick={() => handleServiceClick(block.path)}
                className={`rounded-2xl border p-5 shadow-sm transition hover:border-red-300 hover:shadow-md ${
                  block.isActive
                    ? "border-red-200 bg-red-50 dark:border-red-500/35 dark:bg-red-500/10 dark:hover:border-red-400/50"
                    : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-500"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ServiceIcon type={block.icon} active={block.isActive} />
                    <div>
                      <p
                        className={`text-base font-bold ${
                          block.isActive ? "text-red-600 dark:text-red-300" : "text-gray-900 dark:text-slate-100"
                        }`}
                      >
                        {block.title}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                        {block.subtitle}
                      </p>
                    </div>
                  </div>

                  {block.isActive && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-red-500/20 dark:text-red-200 dark:ring-1 dark:ring-red-400/30">
                      현재
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-gray-500 whitespace-pre-line dark:text-slate-400">
                  {block.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-50">개발의 땅</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                등록된 프로젝트를 살펴보고 함께할 팀을 찾아보세요.
              </p>
            </div>

            <button
              onClick={() => {
                if (!handleProtectedAction()) return;
                router.push("/ideas/new");
              }}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 dark:bg-red-500/105 dark:hover:bg-red-500"
            >
              아이디어 등록하기
            </button>
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="프로젝트 제목, 기술 스택, 해시태그를 검색해보세요"
            className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-red-400/60"
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === cat.label ? null : cat.label
                  )
                }
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedCategory === cat.label
                    ? "border-red-600 bg-red-600 text-white dark:border-red-400/50 dark:bg-red-500/15 dark:text-red-200"
                    : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-300"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
                프로젝트 난이도
              </p>

              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setSelectedDifficulty(
                        selectedDifficulty === option.value ? null : option.value
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedDifficulty === option.value
                        ? "border-red-600 bg-red-600 text-white dark:border-red-400/50 dark:bg-red-500/15 dark:text-red-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
                모집 상태
              </p>

              <div className="flex flex-wrap gap-2">
                {RECRUITMENT_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setSelectedRecruitmentStatus(
                        selectedRecruitmentStatus === option.value
                          ? null
                          : option.value
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedRecruitmentStatus === option.value
                        ? "border-red-600 bg-red-600 text-white dark:border-red-400/50 dark:bg-red-500/15 dark:text-red-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-red-400/40 dark:hover:text-red-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
                정렬 기준
              </p>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-red-400/60"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
              모집 인원 범위
            </p>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <input
                type="number"
                min="1"
                max="100"
                value={memberMin}
                onChange={(e) => setMemberMin(e.target.value)}
                placeholder="최소 인원"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-red-400/60"
              />

              <span className="hidden text-center text-sm text-gray-400 dark:text-slate-600 sm:block">
                -
              </span>

              <input
                type="number"
                min="1"
                max="100"
                value={memberMax}
                onChange={(e) => setMemberMax(e.target.value)}
                placeholder="최대 인원"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-red-400/60"
              />
            </div>
          </div>

          {sortBy === "recommended" && !isLoggedIn && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
              AI 기반 추천순은 로그인 후 기술 스택 정보를 바탕으로 더 정확하게 정렬됩니다.
            </p>
          )}
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">
              {searchQuery ||
              selectedCategory ||
              selectedDifficulty ||
              selectedRecruitmentStatus ||
              memberMin ||
              memberMax
                ? `검색 결과 (${filteredProjects.length})`
                : "전체 프로젝트"}
            </span>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                  setSelectedDifficulty(null);
                  setSelectedRecruitmentStatus(null);
                  setMemberMin("");
                  setMemberMax("");
                  setSortBy("latest");
                }}
                className="text-xs text-gray-400 transition hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                필터 초기화
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
              프로젝트 목록을 불러오는 중...
            </div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-red-500">
              {loadError}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-3 text-3xl">🔍</p>
              <p className="mb-1 text-sm font-medium text-gray-600 dark:text-slate-300">
                등록된 프로젝트가 없어요
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                직접 첫 아이디어를 등록해보세요
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => handleProjectClick(project)}
                />
              ))}
            </div>
          )}
        </section>
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

function SproutHeroIcon() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-24 w-24"
      aria-hidden
      style={{ animation: "floatSprout 3s ease-in-out infinite" }}
    >
      <defs>
        <linearGradient id="sproutStem" x1="44" y1="78" x2="44" y2="34">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <g transform="translate(-7 -5) scale(1.15)">
        <path d="M48 82V38" stroke="url(#sproutStem)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M45 41C23 39 15 24 15 11c19 0 33 9 36 29"
          fill="#22c55e"
        />
        <path
          d="M51 45c23-2 34-16 34-33-20 0-35 10-38 32"
          fill="#16a34a"
        />
        <ellipse cx="48" cy="84" rx="27" ry="7" fill="#92400e" opacity="0.22" />
      </g>
      <style jsx>{`
        @keyframes floatSprout {
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
  const color = active ? "#dc2626" : "#64748b";

  if (type === "seed") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
        <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
          <path
            d="M25 39c8-4 14-11 14-20 0-5-3-9-8-9-8 0-16 9-16 18 0 6 4 10 10 11Z"
            fill="#d97706"
            opacity="0.9"
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
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10">
        <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
          <path
            d="M25 43c9-3 14-9 14-17 0-8-5-13-9-18-1 6-5 9-8 12-2-4-2-7-1-11-7 5-12 12-12 20 0 8 7 14 16 14Z"
            fill="#f97316"
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
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
      <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
        <path
          d="M24 40V20"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M23 23C13 22 9 15 9 8c8 0 15 4 16 14"
          fill="#22c55e"
        />
        <path
          d="M25 25c10-1 15-7 15-14-8 0-15 4-16 13"
          fill="#16a34a"
        />
        <path
          d="M15 41h18"
          stroke="#92400e"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function ProjectCard({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const isAlmostFull =
    project.maxMembers > 0 && project.currentMembers >= project.maxMembers;

  const isRecruiting = isProjectRecruiting(project);

  const competitionRate =
    isRecruiting && project.remainingSeats > 0
      ? project.competitionRatio.toFixed(1)
      : null;

  return (
    <div
      onClick={onClick}
      className="flex w-full cursor-pointer flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-red-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-red-400/40"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-200 dark:ring-1 dark:ring-red-400/25">
            {project.category}
          </span>

          {project.isUrgent && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500 dark:bg-red-500/10 dark:text-red-200 dark:ring-1 dark:ring-red-400/25">
              🔥 마감 임박
            </span>
          )}
        </div>

        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            DIFFICULTY_COLOR[project.difficulty]
          }`}
        >
          {DIFFICULTY_LABEL[project.difficulty]}
        </span>
      </div>

      <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-gray-900 dark:text-slate-50">
        {project.title}
      </h3>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-400 dark:text-slate-400">
        {project.description}
      </p>

      <div className="mb-3 flex flex-wrap gap-1">
        {project.techStack.length ? (
          project.techStack.map((t) => (
            <span
              key={t}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-slate-800 dark:text-slate-300"
            >
              {t}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400 dark:bg-slate-800 dark:text-slate-400">
            기술 스택 없음
          </span>
        )}
      </div>

      {project.hashtags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {project.hashtags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500 dark:bg-red-500/10 dark:text-red-200"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-3 dark:border-slate-700">
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-400">
          <span className={isAlmostFull ? "font-medium text-blue-500 dark:text-blue-300" : ""}>
            👥 {project.currentMembers}/{project.maxMembers ? project.maxMembers : "제한 없음"}명
          </span>

          <span
            className={
              isRecruiting
                ? "font-medium text-green-500 dark:text-emerald-300"
                : "font-medium text-gray-500 dark:text-slate-400"
            }
          >
            {project.openRecruitmentCount > 0 ? "재모집중" : isRecruiting ? "모집중" : "모집완료"}
          </span>
        </div>

        {isRecruiting && competitionRate && (
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-200 dark:ring-1 dark:ring-red-400/25">
            경쟁률 {competitionRate}:1
          </span>
        )}
        {project.openRecruitmentCount > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-200 dark:ring-1 dark:ring-red-400/25">
            {project.openRecruitmentPosition || "재모집"} {project.openRecruitmentRequiredCount}명
          </span>
        )}
      </div>
    </div>
  );
}

function LoginModal({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:border dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <span className="text-2xl">🔒</span>
        </div>

        <h2 className="mb-2 text-base font-bold text-gray-900 dark:text-slate-50">
          로그인이 필요한 서비스예요
        </h2>

        <p className="mb-6 text-sm text-gray-400 dark:text-slate-400">
          프로젝트 참여 및 아이디어 등록은
          <br />
          로그인 후 이용할 수 있어요.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>

          <button
            onClick={onLogin}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 dark:bg-red-500/105 dark:hover:bg-red-500"
          >
            로그인하기
          </button>
        </div>
      </div>
    </div>
  );
}
