"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_CHANGED_EVENT, getToken } from "../../lib/auth";
import { getProjectsApi } from "../../lib/api";

interface Project {
  id: number;
  project_id?: number | null;
  converted_to_project_id?: number | null;
  title: string;
  description: string;
  summary?: string;
  category: string;
  techStack: string[];
  currentMembers: number;
  maxMembers: number;
  status: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  isUrgent: boolean;
}

interface ApiProject {
  id: number;
  title?: string;
  description?: string;
  summary?: string;
  category?: string;
  tech_stack?: string[];
  techStack?: string[];
  currentMembers?: number;
  current_members?: number;
  maxMembers?: number;
  max_members?: number;
  status?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
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
  beginner: "text-emerald-600 bg-emerald-50",
  intermediate: "text-amber-600 bg-amber-50",
  advanced: "text-rose-600 bg-rose-50",
};

const SERVICE_BLOCKS = [
  {
    title: "프로젝트 탐색",
    description: "진행 중인 아이디어와 프로젝트를 둘러보고 함께할 팀을 찾아보세요.",
    path: "/mainpage",
    isActive: true,
  },
  {
    title: "영감의 샘",
    description: "아이디어를 흘려보내고,\n새로운 영감을 건져가세요.",
    path: "/ideas/pickup",
    isActive: false,
  },
  {
    title: "자유항해",
    description: "질문, 회고, 팀원 모집까지\n넓은 바다처럼 자유롭게.",
    path: "/community",
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
    techStack: project.tech_stack || project.techStack || [],
    currentMembers: project.currentMembers ?? project.current_members ?? 0,
    maxMembers: project.maxMembers ?? project.max_members ?? 0,
    status: project.status || "planning",
    difficulty: project.difficulty || "beginner",
    isUrgent: false,
  };
}

export default function MainPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        setLoadError("");

        const result = await getProjectsApi({ page: 1, size: 50 });
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
      router.push(`/projects/${projectId}`);
    } else {
      alert("연결된 프로젝트가 없습니다.");
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchCategory = selectedCategory
      ? p.category === selectedCategory
      : true;

    const matchSearch = searchQuery
      ? p.title.includes(searchQuery) ||
        p.description.includes(searchQuery) ||
        p.techStack.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true;

    return matchCategory && matchSearch;
  });

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
            아이디어를 팀으로,
            <br className="sm:hidden" /> 팀을 프로젝트로
          </h1>

          <p className="mb-8 text-sm text-gray-500 sm:text-base">
            관심 있는 기능을 선택하고 Devory에서 함께할 팀을 찾아보세요
          </p>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {SERVICE_BLOCKS.map((block) => (
              <button
                key={block.title}
                onClick={() => handleServiceClick(block.path)}
                className={`rounded-2xl border p-5 shadow-sm transition hover:border-red-300 hover:shadow-md ${
                  block.isActive
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p
                    className={`text-base font-bold ${
                      block.isActive ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {block.title}
                  </p>

                  {block.isActive && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      현재
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-gray-500 whitespace-pre-line">
                  {block.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">프로젝트 탐색</p>
              <p className="mt-1 text-sm text-gray-500">
                등록된 프로젝트를 살펴보고 함께할 팀을 찾아보세요.
              </p>
            </div>

            <button
              onClick={() => {
                if (!handleProtectedAction()) return;
                router.push("/ideas/new");
              }}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              아이디어 등록하기
            </button>
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="프로젝트 제목이나 기술 스택을 검색해보세요"
            className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
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
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">
              {searchQuery || selectedCategory
                ? `검색 결과 (${filteredProjects.length})`
                : "전체 프로젝트"}
            </span>

            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                }}
                className="text-xs text-gray-400 transition hover:text-gray-600"
              >
                필터 초기화
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              프로젝트 목록을 불러오는 중...
            </div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-red-500">
              {loadError}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-3 text-3xl">🔍</p>
              <p className="mb-1 text-sm font-medium text-gray-600">
                등록된 프로젝트가 없어요
              </p>
              <p className="text-xs text-gray-400">
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

function ProjectCard({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const isAlmostFull =
    project.maxMembers > 0 && project.currentMembers >= project.maxMembers - 1;

  const isRecruiting =
    project.status !== "in_progress" &&
    project.status !== "completed" &&
    (!project.maxMembers || project.currentMembers < project.maxMembers);

  const competitionRate =
    isRecruiting && project.maxMembers > 0
      ? (project.currentMembers / project.maxMembers).toFixed(1)
      : null;

  return (
    <div
      onClick={onClick}
      className="flex w-full cursor-pointer flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-red-200 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
            {project.category}
          </span>

          {project.isUrgent && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
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

      <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-gray-900">
        {project.title}
      </h3>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-400">
        {project.description}
      </p>

      <div className="mb-3 flex flex-wrap gap-1">
        {project.techStack.length ? (
          project.techStack.map((t) => (
            <span
              key={t}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500"
            >
              {t}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
            기술 스택 없음
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-3">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className={isAlmostFull ? "font-medium text-blue-500" : ""}>
            👥 {project.currentMembers}/{project.maxMembers ? project.maxMembers + 1 : "제한 없음"}명
          </span>

          <span
            className={
              isRecruiting
                ? "font-medium text-green-500"
                : "font-medium text-gray-500"
            }
          >
            {isRecruiting ? "모집중" : "모집완료"}
          </span>
        </div>

        {isRecruiting && competitionRate && (
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">
            경쟁률 {competitionRate}:1
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

      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <span className="text-2xl">🔒</span>
        </div>

        <h2 className="mb-2 text-base font-bold text-gray-900">
          로그인이 필요한 서비스예요
        </h2>

        <p className="mb-6 text-sm text-gray-400">
          프로젝트 참여 및 아이디어 등록은
          <br />
          로그인 후 이용할 수 있어요.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition hover:bg-gray-50"
          >
            취소
          </button>

          <button
            onClick={onLogin}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            로그인하기
          </button>
        </div>
      </div>
    </div>
  );
}
