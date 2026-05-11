"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createProjectRetrospectiveApi,
  getMyProjectsApi,
  getProjectApi,
  getProjectProgressApi,
  getProjectRetrospectiveApi,
  getProjectRetrospectivesApi,
  getProjectReviewsApi,
  getProjectsApi,
  updateProjectRetrospectiveApi,
} from "../../lib/api";

interface Rating {
  avg_contribution: number;
  avg_responsibility: number;
  avg_teamwork: number;
}

interface GrowthData {
  chips: string[];
  good: string;
  bad: string;
  lessons?: string;
  nextActions?: string;
}

interface ProjectData {
  id: number;
  title: string;
  summary?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  difficulty?: string | null;
  progress_percent?: number;
  created_at?: string | null;
  techStack?: string[];
  currentMembers?: number;
  maxMembers?: number;
}

interface ProgressData {
  todo_total: number;
  todo_done: number;
  progress_percent: number;
}

interface ProjectReview {
  id: number;
  teamwork_score?: number;
  contribution_score?: number;
  responsibility_score?: number;
  comment?: string | null;
}

interface RetrospectiveSummary {
  id: number;
  title: string;
  author_id?: number;
}

interface RetrospectiveDetail {
  id: number;
  title: string;
  what_went_well?: string | null;
  what_went_badly?: string | null;
  lessons_learned?: string | null;
  next_actions?: string | null;
}

const REVIEW_MESSAGES: Record<string, Record<number, string>> = {
  기여도: {
    5: "프로젝트를 앞으로 끌고 가는 힘이 아주 인상적이었어요.",
    4: "맡은 역할을 안정적으로 수행하며 팀에 분명한 기여를 남겼어요.",
    3: "필요한 순간마다 역할을 해냈고, 다음에는 더 선명한 기여를 기대해볼 수 있어요.",
    2: "기여의 방향은 보였지만 다음 프로젝트에서는 더 적극적인 참여가 필요해 보여요.",
    1: "시작점에 가까웠어요. 다음에는 더 많은 실행 경험을 쌓아보면 좋아요.",
  },
  책임감: {
    5: "믿고 맡길 수 있는 팀원이라는 인상을 강하게 남겼어요.",
    4: "맡은 일을 끝까지 챙기는 태도가 팀에 안정감을 줬어요.",
    3: "기본적인 책임을 해냈고, 꾸준함을 조금 더 키우면 좋아요.",
    2: "완료까지 이어지는 힘을 더 키우면 다음에는 훨씬 좋아질 거예요.",
    1: "작은 약속부터 차근차근 지켜나가는 연습이 필요해 보여요.",
  },
  협업: {
    5: "팀의 방향을 맞추고 분위기를 좋게 만드는 협업력이 돋보였어요.",
    4: "의견을 잘 나누고 팀의 흐름에 맞춰 움직였어요.",
    3: "필요한 소통은 해냈고, 조금 더 먼저 말 걸면 더 좋아질 것 같아요.",
    2: "협업의 시도는 있었지만 표현과 공유를 더 자주 하면 좋아요.",
    1: "다음 프로젝트에서는 팀원들과 더 자주 맞춰보는 경험이 필요해요.",
  },
};

const TECH_CHIPS = [
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "Python",
  "Spring Boot",
  "Flutter",
  "Firebase",
  "Docker",
  "AWS",
];

const FIELD_CHIPS = [
  "프론트엔드",
  "백엔드",
  "모바일",
  "UI/UX 디자인",
  "데이터 분석",
  "AI/ML",
  "DevOps",
  "기획/PM",
  "팀 리드",
];

function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function toDateLabel(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function daysBetween(start?: string | null) {
  if (!start) return 0;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 0;
  const diff = Date.now() - startDate.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function pickProjectFromList(projects: ProjectData[]) {
  return (
    projects.find((project) => project.status === "completed") ||
    projects.find((project) => project.status === "in_progress") ||
    projects[0] ||
    null
  );
}

function parseLessonsLearned(value?: string | null): { chips: string[]; lessons: string } {
  if (!value) return { chips: [], lessons: "" };

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return {
        chips: Array.isArray(parsed.chips) ? parsed.chips.filter(Boolean) : [],
        lessons: typeof parsed.lessons === "string" ? parsed.lessons : "",
      };
    }
  } catch {
    // Older retrospectives stored this as a comma-separated plain string.
  }

  return {
    chips: value
      .split(",")
      .map((chip) => chip.trim())
      .filter(Boolean),
    lessons: "",
  };
}

function stringifyLessonsLearned(data: GrowthData) {
  return JSON.stringify({
    chips: data.chips,
    lessons: data.lessons || "",
  });
}

function Stars({ score, avg }: { score: number; avg: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-[13px] ${i <= score ? "opacity-100" : "opacity-20"}`}>
          ★
        </span>
      ))}
      <span className="ml-1 text-[11px] text-red-300">{avg.toFixed(1)}</span>
    </div>
  );
}

function ReviewSection({ rating }: { rating: Rating }) {
  const items = [
    { label: "기여도", avg: rating.avg_contribution },
    { label: "책임감", avg: rating.avg_responsibility },
    { label: "협업", avg: rating.avg_teamwork },
  ];

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ label, avg }) => {
        const score = Math.min(5, Math.max(1, Math.round(avg || 0)));

        return (
          <div key={label} className="rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-red-700">{label}</span>
              <Stars score={score} avg={avg || 0} />
            </div>

            <p className="m-0 text-[13px] leading-7 text-red-950">
              {avg > 0 ? REVIEW_MESSAGES[label][score] : "아직 이 항목의 리뷰 데이터가 없어요."}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function GrowthModal({
  initialData,
  saving,
  onClose,
  onSave,
}: {
  initialData: GrowthData | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: GrowthData) => void;
}) {
  const initialChips = initialData?.chips || [];
  const [selectedTech, setSelectedTech] = useState<string[]>(
    initialChips.filter((chip) => TECH_CHIPS.includes(chip))
  );
  const [selectedField, setSelectedField] = useState<string[]>(
    initialChips.filter((chip) => FIELD_CHIPS.includes(chip))
  );
  const [customInput, setCustomInput] = useState(
    initialChips
      .filter((chip) => !TECH_CHIPS.includes(chip) && !FIELD_CHIPS.includes(chip))
      .join(", ")
  );
  const [good, setGood] = useState(initialData?.good || "");
  const [bad, setBad] = useState(initialData?.bad || "");
  const [lessons, setLessons] = useState(initialData?.lessons || "");
  const [nextActions, setNextActions] = useState(initialData?.nextActions || "");

  function toggle(arr: string[], setArr: (value: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function handleSave() {
    const custom = customInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const chips = [...selectedTech, ...selectedField, ...custom];

    if (!chips.length && !good.trim() && !bad.trim() && !lessons.trim() && !nextActions.trim()) {
      alert("하나 이상 선택하거나 입력해주세요.");
      return;
    }

    onSave({ chips, good, bad, lessons, nextActions });
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40"
    >
      <div className="max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-[24px] bg-white px-5 pb-10 pt-5">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-red-100" />

        <p className="mb-1 text-xl font-bold text-red-950">성장 기록하기</p>
        <p className="mb-6 text-sm text-red-300">프로젝트에서 배운 것과 다음에 가져갈 점을 남겨보세요.</p>

        {[
          { title: "기술 스택", chips: TECH_CHIPS, selected: selectedTech, setSelected: setSelectedTech },
          { title: "분야", chips: FIELD_CHIPS, selected: selectedField, setSelected: setSelectedField },
        ].map(({ title, chips, selected, setSelected }) => (
          <div key={title} className="mb-5">
            <p className="mb-2 text-xs font-bold text-red-700">
              {title} <span className="font-normal text-red-300">(복수 선택)</span>
            </p>

            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => toggle(selected, setSelected, chip)}
                  className={`rounded-full border px-4 py-1.5 text-[13px] transition ${
                    selected.includes(chip)
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-red-100 bg-red-50 text-red-700 hover:border-red-300"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="mb-2 text-xs font-bold text-red-700">
          직접 입력 <span className="font-normal text-red-300">(쉼표로 구분)</span>
        </p>

        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="GraphQL, 외부 API 연동, 코드 리뷰"
          className="mb-4 w-full rounded-xl border border-red-100 bg-red-50/40 px-4 py-3 text-sm text-red-950 outline-none focus:border-red-300"
        />

        {[
          { label: "좋았던 점", value: good, setter: setGood, placeholder: "기억에 남는 성과나 좋았던 경험을 적어주세요." },
          { label: "아쉬웠던 점", value: bad, setter: setBad, placeholder: "다음 프로젝트에서 개선하고 싶은 점을 적어주세요." },
          { label: "배운 점", value: lessons, setter: setLessons, placeholder: "이번 프로젝트를 통해 배운 내용을 적어주세요." },
          { label: "다음 액션", value: nextActions, setter: setNextActions, placeholder: "다음에 시도할 구체적인 행동을 적어주세요." },
        ].map(({ label, value, setter, placeholder }) => (
          <div key={label} className="mb-4">
            <p className="mb-2 text-xs font-bold text-red-700">{label}</p>
            <textarea
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full resize-none rounded-xl border border-red-100 bg-red-50/40 px-4 py-3 text-sm leading-7 text-red-950 outline-none focus:border-red-300"
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 w-full rounded-2xl bg-red-600 py-4 text-base font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          {saving ? "저장 중..." : "회고 저장하기"}
        </button>
      </div>
    </div>
  );
}

function Section({
  emoji,
  label,
  headline,
  children,
}: {
  emoji: string;
  label: string;
  headline: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-4 mt-5 overflow-hidden rounded-2xl border border-red-100 bg-white">
      <div className="flex items-center gap-2 px-5 pt-5">
        <span className="text-xl leading-none">{emoji}</span>
        <span className="text-[11px] text-red-300">{label}</span>
      </div>

      <p className="m-0 px-5 pb-5 pt-2 text-lg font-bold leading-7 text-red-950">{headline}</p>

      <div className="mx-5 h-px bg-red-50" />
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function MemoirContent() {
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("projectId");

  const [modalOpen, setModalOpen] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [reviews, setReviews] = useState<ProjectReview[]>([]);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [retrospectiveId, setRetrospectiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadMemoir() {
      try {
        setLoading(true);
        setError("");

        let selectedProject: ProjectData | null = null;

        if (requestedProjectId) {
          const [detailResult, listResult] = await Promise.allSettled([
            getProjectApi(requestedProjectId),
            getProjectsApi({ page: 1, size: 100 }),
          ]);

          if (detailResult.status === "fulfilled") {
            selectedProject = detailResult.value.data;
          }

          if (selectedProject && listResult.status === "fulfilled") {
            const listed = (listResult.value.data || []).find(
              (item: ProjectData) => Number(item.id) === Number(selectedProject?.id)
            );
            selectedProject = { ...listed, ...selectedProject };
          }
        } else {
          const myProjectsResult = await getMyProjectsApi().catch(() => null);
          selectedProject = pickProjectFromList(myProjectsResult?.data || []);

          if (!selectedProject) {
            const completedResult = await getProjectsApi({ page: 1, size: 20, status: "completed" });
            selectedProject = pickProjectFromList(completedResult.data || []);
          }
        }

        if (!selectedProject) {
          throw new Error("회고를 보여줄 프로젝트가 없습니다.");
        }

        const projectId = selectedProject.id;
        const [progressResult, reviewsResult, retrospectivesResult] = await Promise.allSettled([
          getProjectProgressApi(projectId),
          getProjectReviewsApi(projectId),
          getProjectRetrospectivesApi(projectId),
        ]);

        let loadedGrowth: GrowthData | null = null;
        let loadedRetrospectiveId: number | null = null;

        if (retrospectivesResult.status === "fulfilled") {
          const firstRetrospective = (retrospectivesResult.value.data || [])[0] as
            | RetrospectiveSummary
            | undefined;

          if (firstRetrospective) {
            const detail = await getProjectRetrospectiveApi(projectId, firstRetrospective.id);
            const retrospective = detail.data as RetrospectiveDetail;
            const lessonsLearned = parseLessonsLearned(retrospective.lessons_learned);
            loadedRetrospectiveId = retrospective.id;
            loadedGrowth = {
              chips: lessonsLearned.chips,
              good: retrospective.what_went_well || "",
              bad: retrospective.what_went_badly || "",
              lessons: lessonsLearned.lessons,
              nextActions: retrospective.next_actions || "",
            };
          }
        }

        if (ignore) return;

        setProject(selectedProject);
        setProgress(progressResult.status === "fulfilled" ? progressResult.value.data : null);
        setReviews(reviewsResult.status === "fulfilled" ? reviewsResult.value.data || [] : []);
        setGrowth(loadedGrowth);
        setRetrospectiveId(loadedRetrospectiveId);
      } catch (err) {
        console.error(err);
        if (!ignore) setError(err instanceof Error ? err.message : "회고 데이터를 불러오지 못했습니다.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMemoir();

    return () => {
      ignore = true;
    };
  }, [requestedProjectId]);

  const rating = useMemo<Rating>(() => {
    return {
      avg_contribution: average(reviews.map((review) => Number(review.contribution_score || 0)).filter(Boolean)),
      avg_responsibility: average(reviews.map((review) => Number(review.responsibility_score || 0)).filter(Boolean)),
      avg_teamwork: average(reviews.map((review) => Number(review.teamwork_score || 0)).filter(Boolean)),
    };
  }, [reviews]);

  const todoTotal = progress?.todo_total ?? 0;
  const todoDone = progress?.todo_done ?? 0;
  const todoPercent = Math.round(progress?.progress_percent ?? 0);
  const durationDays = daysBetween(project?.created_at);
  const hours = durationDays * 6;
  const techStack = project?.techStack?.length ? project.techStack : [project?.category || "프로젝트"];

  async function handleSaveGrowth(data: GrowthData) {
    if (!project) return;

    try {
      setSaving(true);

      const payload = {
        title: `${project.title} 회고`,
        what_went_well: data.good,
        what_went_badly: data.bad,
        lessons_learned: stringifyLessonsLearned(data),
        next_actions: data.nextActions || data.lessons || "",
      };

      if (retrospectiveId) {
        await updateProjectRetrospectiveApi(project.id, retrospectiveId, payload);
      } else {
        const result = await createProjectRetrospectiveApi(project.id, payload);
        setRetrospectiveId(result.data?.id || null);
      }

      setGrowth(data);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "회고 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function buildFeelingText(data: GrowthData): React.ReactNode {
    return (
      <>
        {data.good.trim() && (
          <p>
            이번 프로젝트에서 가장 값진 순간은 <strong>{data.good}</strong>이었어요.
          </p>
        )}
        {data.bad.trim() && (
          <p>
            <strong>{data.bad}</strong> 부분은 아쉬웠지만, 그걸 알아차린 것 자체가 다음 성장의
            시작이에요.
          </p>
        )}
        {(data.lessons || data.nextActions) && (
          <p>{data.nextActions || data.lessons}</p>
        )}
        <p>쌓인 기록은 다음 프로젝트에서 더 단단한 선택으로 돌아올 거예요.</p>
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50/40 px-6 text-center text-sm text-red-500">
        회고 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50/40 px-6 text-center">
        <div>
          <p className="text-lg font-bold text-red-950">회고를 불러오지 못했어요</p>
          <p className="mt-2 text-sm text-red-400">{error || "프로젝트 정보가 없습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-50/40 text-red-950">
      <section className="border-b border-red-100 bg-red-100 px-5 py-10 text-center">
        <div className="mb-4 inline-block rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white">
          개발자의 성장 일기
        </div>

        <h1 className="mb-2 text-2xl font-bold leading-snug text-red-950">{project.title}</h1>

        <p className="m-0 text-sm text-red-500">{project.summary || "프로젝트를 마친 기록을 정리해요."}</p>

        <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-red-200 bg-white/70 px-4 py-1.5 text-[13px] text-red-700">
          {toDateLabel(project.created_at)} 시작 · {durationDays || "?"}일간의 여정
        </div>
      </section>

      <Section emoji="✅" label="Todo 달성" headline={<>나는 {todoDone}개의 일을 완료했어요</>}>
        <p className="m-0 text-5xl font-bold leading-none text-red-600">
          {todoDone}
          <span className="ml-1 text-base text-red-300">개 완료</span>
        </p>

        <div className="my-3 h-3 overflow-hidden rounded-full border border-red-100 bg-red-50">
          <div className="h-full rounded-full bg-red-600" style={{ width: `${todoPercent}%` }} />
        </div>

        <div className="flex justify-between text-xs text-red-300">
          <span>전체 {todoTotal}개 중</span>
          <span className="font-bold text-red-600">{todoPercent}% 달성</span>
        </div>
      </Section>

      <Section emoji="🌟" label="팀 리뷰 기반 평균" headline="나는 이런 팀원이었어요">
        <ReviewSection rating={rating} />
      </Section>

      <Section emoji="🧩" label="프로젝트 소개" headline="나는 이런 프로젝트를 만들었어요">
        <div className="rounded-r-2xl border-l-4 border-red-400 bg-red-50/60 px-4 py-3 text-sm leading-8 text-red-900">
          {project.description || project.summary || "프로젝트 설명이 아직 없습니다."}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {techStack.map((tag) => (
            <span key={tag} className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs text-red-700">
              {tag}
            </span>
          ))}
        </div>
      </Section>

      <Section emoji="⏱️" label="투자한 시간" headline={<>나는 약 {hours}시간 동안 프로젝트를 수행했어요</>}>
        <p className="m-0 text-5xl font-bold leading-none text-red-600">
          {hours}
          <span className="ml-1 text-lg text-red-300">시간</span>
        </p>

        <p className="mt-2 text-[13px] text-red-300">
          {durationDays || "?"}일 · 하루 평균 6시간 기준
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { val: `${durationDays || 0}일`, label: "총 프로젝트 기간" },
            { val: `${Math.ceil((durationDays || 0) / 7)}주`, label: "함께한 기간" },
          ].map(({ val, label }) => (
            <div key={label} className="rounded-2xl border border-red-100 bg-red-50/50 p-3 text-center">
              <p className="m-0 text-xl font-bold text-red-600">{val}</p>
              <p className="mt-1 text-[11px] text-red-300">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="🌱" label="나의 성장" headline="나는 이만큼 성장했어요">
        {!growth ? (
          <button
            onClick={() => setModalOpen(true)}
            className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 px-4 py-6 text-center transition hover:border-red-300"
          >
            <span className="text-3xl">＋</span>

            <span className="text-sm leading-7 text-red-700">
              새롭게 알게 된 것들을 기록해보세요
              <br />
              <span className="text-xs text-red-300">기술 스택, 분야, 좋았던 점, 아쉬웠던 점을 남길 수 있어요.</span>
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-2 text-xs text-red-300">새롭게 알게 된 것들</p>

              <div className="flex flex-wrap gap-2">
                {growth.chips.map((chip) => (
                  <span key={chip} className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs text-red-700">
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="self-start rounded-xl border border-red-100 bg-white px-4 py-2 text-xs text-red-700 transition hover:border-red-300"
            >
              수정하기
            </button>
          </div>
        )}
      </Section>

      <Section emoji="💬" label="회고 정리" headline="나는 이런 점을 느꼈어요">
        {!growth || (!growth.good.trim() && !growth.bad.trim() && !growth.nextActions?.trim()) ? (
          <p className="m-0 py-5 text-center text-[13px] leading-8 text-red-300">
            위에서 성장 기록을 작성하면
            <br />
            회고 문장이 이곳에 정리돼요.
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-red-100 bg-red-50/50 p-5">
            <span className="absolute -top-3 left-3 text-7xl leading-none text-red-100">&quot;</span>

            <div className="relative z-10 space-y-4 pl-2 text-sm leading-8 text-red-950">
              {buildFeelingText(growth)}
            </div>

            <span className="mt-4 inline-block rounded-full bg-red-100 px-3 py-1 text-[11px] text-red-700">
              저장된 회고를 바탕으로 정리했어요
            </span>
          </div>
        )}
      </Section>

      <footer className="mx-4 mb-10 mt-6 rounded-2xl bg-red-600 px-5 py-6 text-center text-white">
        <p className="mb-2 text-4xl">🎉</p>
        <p className="mb-2 text-xl font-bold">프로젝트 회고가 쌓였어요!</p>
        <p className="m-0 text-[13px] leading-7 opacity-90">
          지금 남긴 기록은
          <br />
          다음 프로젝트를 더 잘 시작하게 해줄 거예요.
        </p>
      </footer>

      {modalOpen && (
        <GrowthModal
          initialData={growth}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveGrowth}
        />
      )}
    </div>
  );
}

export default function MemoirPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-red-50/40 px-6 text-center text-sm text-red-500">
          회고 데이터를 준비하는 중입니다...
        </div>
      }
    >
      <MemoirContent />
    </Suspense>
  );
}
