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
  refineProjectMemoirApi,
  updateProjectRetrospectiveApi,
} from "../../lib/api";

/* ────────────────────────────────────────────────────────────
   타입
──────────────────────────────────────────────────────────── */
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
  aiMemoir?: string;
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

interface MemoirOverviewItem {
  project: ProjectData;
  retrospectiveId: number | null;
  growth: GrowthData | null;
}

/* ────────────────────────────────────────────────────────────
   리뷰 멘트 시스템 (미리보기와 동일)
──────────────────────────────────────────────────────────── */
const REVIEW_MESSAGES: Record<string, Record<number, string>> = {
  기여도: {
    5: "팀이 앞으로 나아갈 수 있도록 누구보다 앞장서서 힘을 보탠 사람이에요. 당신 덕분에 팀이 움직였어요.",
    4: "팀에 진심으로 힘을 보태며 함께 달린 사람이에요. 당신의 기여가 팀의 속도를 만들었어요.",
    3: "필요한 순간마다 제 몫을 다한 사람이에요. 꾸준함이 쌓이면 더 빛날 거예요.",
    2: "한 발짝씩 팀에 보탬이 되려 노력한 사람이에요. 다음엔 더 많이 함께할 수 있을 거예요.",
    1: "시작이 반이에요. 이 경험이 다음 기여의 씨앗이 될 거예요.",
  },
  책임감: {
    5: "팀에서 가장 믿음직한 버팀목이었어요. 누구도 걱정하지 않아도 될 만큼 든든한 사람이었어요.",
    4: "맡은 일을 끝까지 놓지 않는 든든한 버팀목이었어요. 팀원들이 믿고 기댈 수 있는 사람이었어요.",
    3: "주어진 역할을 성실하게 해낸 사람이에요. 책임감의 근육이 이미 자라고 있어요.",
    2: "때로는 흔들렸지만 포기하지 않은 사람이에요. 그 자체가 이미 책임감의 출발이에요.",
    1: "완주했다는 것 자체가 책임감의 증거예요. 다음엔 더 탄탄해질 거예요.",
  },
  소통: {
    5: "팀의 언어를 만든 사람이에요. 당신이 있어서 모두가 같은 방향을 볼 수 있었어요.",
    4: "의견을 명확하게 전달하고 팀의 목소리를 귀 기울여 들을 줄 아는, 연결고리 같은 사람이었어요.",
    3: "필요한 말을 할 줄 아는 사람이에요. 조금 더 먼저 말을 걸어보면 어떨까요?",
    2: "표현하는 게 쉽지 않았겠지만, 시도한 것만으로도 충분히 의미 있어요.",
    1: "말 한마디가 팀을 바꿀 수 있어요. 다음엔 더 많이 표현해봐요.",
  },
};

const TECH_CHIPS = ["React", "Next.js", "TypeScript", "Node.js", "Python", "Spring Boot", "Flutter", "Firebase", "Docker", "AWS"];
const FIELD_CHIPS = ["프론트엔드", "백엔드", "모바일", "UI/UX 디자인", "데이터 분석", "AI/ML", "DevOps", "기획/PM", "팀 리드"];

/* ────────────────────────────────────────────────────────────
   유틸
──────────────────────────────────────────────────────────── */
function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
}

function toDateLabel(value?: string | null) {
  if (!value) return "기록 없음";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "기록 없음";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function daysBetween(start?: string | null) {
  if (!start) return 0;
  const d = new Date(start);
  if (isNaN(d.getTime())) return 0;
  return Math.max(1, Math.ceil((Date.now() - d.getTime()) / 86400000));
}

function parseLessonsLearned(value?: string | null): {
  chips: string[];
  lessons: string;
  aiMemoir: string;
} {
  if (!value) return { chips: [], lessons: "", aiMemoir: "" };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return {
        chips: Array.isArray(parsed.chips) ? parsed.chips.filter(Boolean) : [],
        lessons: typeof parsed.lessons === "string" ? parsed.lessons : "",
        aiMemoir: typeof parsed.aiMemoir === "string" ? parsed.aiMemoir : "",
      };
    }
  } catch {}
  return {
    chips: value.split(",").map((c) => c.trim()).filter(Boolean),
    lessons: "",
    aiMemoir: "",
  };
}

function stringifyLessonsLearned(data: GrowthData) {
  return JSON.stringify({
    chips: data.chips,
    lessons: data.lessons || "",
    aiMemoir: data.aiMemoir || "",
  });
}

/* ── 서수 (1번째, 2번째…) ── */
function ordinalKo(n: number) {
  return `${n}번째`;
}

/* ────────────────────────────────────────────────────────────
   장미 SVG
──────────────────────────────────────────────────────────── */
function RoseSVG() {
  return (
    <svg viewBox="0 0 160 200" width={110} height={137} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* 줄기 */}
      <path d="M80 138 Q76 158 73 178 Q74 179 75 178 Q78 160 80 140" stroke="#4a7c3f" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <path d="M80 138 Q84 158 87 178 Q88 179 87 178 Q84 160 80 140" stroke="#3d6b33" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* 잎 왼쪽 */}
      <path d="M76 155 Q54 148 50 132 Q64 136 76 155Z" fill="#5a9e4a" opacity="0.9"/>
      <path d="M76 155 Q63 149 62 138" stroke="#4a7c3f" strokeWidth="1" fill="none"/>
      {/* 잎 오른쪽 */}
      <path d="M84 162 Q106 154 108 138 Q94 143 84 162Z" fill="#5a9e4a" opacity="0.85"/>
      <path d="M84 162 Q97 155 97 144" stroke="#4a7c3f" strokeWidth="1" fill="none"/>
      {/* 꽃받침 */}
      <path d="M62 118 Q70 108 80 106 Q90 108 98 118 Q95 128 80 130 Q65 128 62 118Z" fill="#4a7c3f"/>
      <path d="M62 118 Q58 112 64 106 Q70 112 62 118Z" fill="#5a9e4a"/>
      <path d="M98 118 Q102 112 96 106 Q90 112 98 118Z" fill="#5a9e4a"/>
      <path d="M80 106 Q76 96 80 90 Q84 96 80 106Z" fill="#5a9e4a"/>
      {/* 꽃잎 맨 바깥 레이어 */}
      <path d="M80 30 Q54 20 48 42 Q50 62 80 68 Q110 62 112 42 Q106 20 80 30Z" fill="#ff6b6b"/>
      <path d="M42 58 Q24 52 26 76 Q32 96 62 96 Q74 88 68 68 Q54 60 42 58Z" fill="#ff6b6b"/>
      <path d="M118 58 Q136 52 134 76 Q128 96 98 96 Q86 88 92 68 Q106 60 118 58Z" fill="#ff6b6b"/>
      <path d="M54 100 Q40 106 46 126 Q56 140 80 136 Q86 122 78 108 Q66 100 54 100Z" fill="#ff6b6b"/>
      <path d="M106 100 Q120 106 114 126 Q104 140 80 136 Q74 122 82 108 Q94 100 106 100Z" fill="#ff6b6b"/>
      {/* 꽃잎 중간 레이어 */}
      <path d="M80 36 Q58 28 54 50 Q56 68 80 74 Q104 68 106 50 Q102 28 80 36Z" fill="#e74c3c"/>
      <path d="M50 66 Q34 64 36 84 Q42 100 68 98 Q78 90 72 74 Q60 66 50 66Z" fill="#e74c3c"/>
      <path d="M110 66 Q126 64 124 84 Q118 100 92 98 Q82 90 88 74 Q100 66 110 66Z" fill="#e74c3c"/>
      <path d="M60 104 Q48 112 54 128 Q62 140 80 136 Q84 124 78 112 Q68 104 60 104Z" fill="#e74c3c"/>
      <path d="M100 104 Q112 112 106 128 Q98 140 80 136 Q76 124 82 112 Q92 104 100 104Z" fill="#e74c3c"/>
      {/* 꽃잎 안쪽 레이어 */}
      <path d="M80 44 Q62 40 60 58 Q62 72 80 78 Q98 72 100 58 Q98 40 80 44Z" fill="#c0392b"/>
      <path d="M58 74 Q46 76 48 90 Q54 104 74 102 Q82 94 76 80 Q66 72 58 74Z" fill="#c0392b"/>
      <path d="M102 74 Q114 76 112 90 Q106 104 86 102 Q78 94 84 80 Q94 72 102 74Z" fill="#c0392b"/>
      {/* 중심 */}
      <ellipse cx="80" cy="72" rx="18" ry="20" fill="#a93226"/>
      <ellipse cx="80" cy="70" rx="12" ry="14" fill="#922b21"/>
      <ellipse cx="80" cy="68" rx="7" ry="8" fill="#7b241c"/>
      {/* 꽃잎 하이라이트 */}
      <path d="M72 38 Q66 46 68 56" stroke="#ff8a80" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M40 66 Q38 76 42 84" stroke="#ff8a80" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   Stars
──────────────────────────────────────────────────────────── */
function Stars({ score, avg }: { score: number; avg: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ fontSize: 13, opacity: i <= score ? 1 : 0.2, color: "#c0392b" }}>⭐</span>
      ))}
      <span style={{ fontSize: 11, color: "#c08080", marginLeft: 5 }}>
        {avg.toFixed(1)}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ReviewSection
──────────────────────────────────────────────────────────── */
function ReviewSection({ rating }: { rating: Rating }) {
  const items = [
    { label: "기여도", avg: rating.avg_contribution },
    { label: "책임감", avg: rating.avg_responsibility },
    { label: "소통",   avg: rating.avg_teamwork },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map(({ label, avg }) => {
        const score = Math.min(5, Math.max(1, Math.round(avg || 0)));
        return (
          <div key={label} style={{ background: "#fdf4f4", border: "1px solid #f0cccc", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: "#a83030", fontWeight: 700 }}>{label}</span>
              <Stars score={score} avg={avg || 0} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#6b2020", lineHeight: 1.7 }}>
              {avg > 0 ? REVIEW_MESSAGES[label][score] : "아직 이 항목의 리뷰 데이터가 없어요."}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   GrowthModal
──────────────────────────────────────────────────────────── */
function GrowthModal({
  initialData,
  saving,
  generating,
  onClose,
  onSave,
  onGenerate,
}: {
  initialData: GrowthData | null;
  saving: boolean;
  generating: boolean;
  onClose: () => void;
  onSave: (data: GrowthData) => void;
  onGenerate: (data: GrowthData) => Promise<string>;
}) {
  const init = initialData?.chips || [];
  const [selectedTech, setSelectedTech]   = useState<string[]>(init.filter((c) => TECH_CHIPS.includes(c)));
  const [selectedField, setSelectedField] = useState<string[]>(init.filter((c) => FIELD_CHIPS.includes(c)));
  const [customInput, setCustomInput]     = useState(init.filter((c) => !TECH_CHIPS.includes(c) && !FIELD_CHIPS.includes(c)).join(", "));
  const [good, setGood]                   = useState(initialData?.good || "");
  const [bad, setBad]                     = useState(initialData?.bad || "");
  const [lessons, setLessons]             = useState(initialData?.lessons || "");
  const [nextActions, setNextActions]     = useState(initialData?.nextActions || "");
  const [aiMemoir, setAiMemoir]           = useState(initialData?.aiMemoir || "");

  function toggle(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function handleSave() {
    const custom = customInput.split(",").map((s) => s.trim()).filter(Boolean);
    const chips  = [...selectedTech, ...selectedField, ...custom];
    if (!chips.length && !good.trim() && !bad.trim() && !lessons.trim() && !nextActions.trim() && !aiMemoir.trim()) {
      alert("하나 이상 선택하거나 입력해주세요 🌹");
      return;
    }
    onSave({ chips, good, bad, lessons, nextActions, aiMemoir });
  }

  async function handleGenerate() {
    const custom = customInput.split(",").map((s) => s.trim()).filter(Boolean);
    const chips = [...selectedTech, ...selectedField, ...custom];
    if (!good.trim() && !bad.trim()) {
      alert("느낀 점이나 부족했던 점을 먼저 입력해주세요.");
      return;
    }

    try {
      const result = await onGenerate({ chips, good, bad, lessons, nextActions, aiMemoir });
      setAiMemoir(result);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "AI 회고록 생성에 실패했습니다.");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid #f0c8c8", borderRadius: 10,
    padding: "10px 14px", fontSize: 13,
    color: "#3c1010", background: "#fdf8f8", outline: "none", boxSizing: "border-box",
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "22px 22px 40px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, background: "#f0d0d0", borderRadius: 4, margin: "0 auto 18px" }} />
        <p style={{ fontSize: 20, fontWeight: 800, color: "#5c0a0a", marginBottom: 4 }}>🌹 성장 기록하기</p>
        <p style={{ fontSize: 13, color: "#c08080", marginBottom: 22 }}>이 프로젝트에서 새롭게 도전한 것들을 골라봐요</p>

        {[
          { title: "기술 스택", chips: TECH_CHIPS, selected: selectedTech, setSelected: setSelectedTech },
          { title: "분야",     chips: FIELD_CHIPS, selected: selectedField, setSelected: setSelectedField },
        ].map(({ title, chips, selected, setSelected }) => (
          <div key={title} style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: "#a83030", fontWeight: 700, marginBottom: 9 }}>
              {title} <span style={{ fontWeight: 400, color: "#c08080" }}>(복수 선택)</span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => toggle(selected, setSelected, chip)}
                  style={{
                    padding: "7px 15px", borderRadius: 20, border: "1px solid", cursor: "pointer",
                    fontSize: 13, transition: "all .15s",
                    background: selected.includes(chip) ? "#9b1c1c" : "#fdf4f4",
                    color:      selected.includes(chip) ? "#fdf0f0" : "#9b1c1c",
                    borderColor: selected.includes(chip) ? "#9b1c1c" : "#f0c0c0",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ))}

        <p style={{ fontSize: 12, color: "#a83030", fontWeight: 700, marginBottom: 9 }}>
          직접 입력 <span style={{ fontWeight: 400, color: "#c08080" }}>(쉼표로 구분)</span>
        </p>
        <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="예: GraphQL, 외부 API 연동, 코드 리뷰" style={{ ...inputStyle, marginBottom: 14 }} />

        {[
          { label: "느낀 점",     value: good,        setValue: setGood,        ph: "이 프로젝트에서 배운 점, 좋았던 경험을 자유롭게 적어주세요 🌹" },
          { label: "부족했던 점", value: bad,         setValue: setBad,         ph: "아쉬웠던 점, 다음엔 개선하고 싶은 것을 적어주세요" },
          { label: "배운 점",     value: lessons,     setValue: setLessons,     ph: "이번 프로젝트를 통해 새롭게 배운 내용을 적어주세요" },
          { label: "다음 액션",   value: nextActions, setValue: setNextActions, ph: "다음에 시도할 구체적인 행동을 적어주세요" },
        ].map(({ label, value, setValue, ph }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#a83030", fontWeight: 700, marginBottom: 9 }}>
              {label} <span style={{ fontWeight: 400, color: "#c08080" }}>(선택)</span>
            </p>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={ph}
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.8, minHeight: 80 }}
            />
          </div>
        ))}

        <button
          onClick={handleGenerate}
          disabled={saving || generating || (!good.trim() && !bad.trim())}
          style={{
            width: "100%",
            background: generating ? "#f0a0a0" : "#fff",
            color: generating ? "#fff" : "#9b1c1c",
            border: "1px solid #f0c0c0",
            borderRadius: 14,
            padding: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: saving || generating || (!good.trim() && !bad.trim()) ? "not-allowed" : "pointer",
            marginTop: 2,
            marginBottom: 12,
          }}
        >
          {generating ? "AI가 회고록을 만드는 중..." : "AI에게 회고록 만들기"}
        </button>

        {aiMemoir.trim() && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#a83030", fontWeight: 700, marginBottom: 9 }}>
              AI 회고록 초안
            </p>
            <textarea
              value={aiMemoir}
              onChange={(e) => setAiMemoir(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.8, minHeight: 120 }}
            />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", background: saving ? "#f0a0a0" : "#9b1c1c", color: "#fdf0f0",
            border: "none", borderRadius: 14, padding: 16, fontSize: 16,
            cursor: saving ? "not-allowed" : "pointer", marginTop: 6,
          }}
        >
          {saving ? "저장 중..." : "수확 기록 저장하기 🌹"}
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Section
──────────────────────────────────────────────────────────── */
function Section({ emoji, label, headline, children }: {
  emoji: string;
  label: string;
  headline: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 20, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
      <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontSize: 12, color: "#e60012", fontWeight: 700 }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, color: "#0f172a", padding: "8px 24px 18px", fontWeight: 800, lineHeight: 1.45, margin: 0 }}>
        {headline}
      </p>
      <div style={{ height: 1, background: "#e2e8f0" }} />
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   MemoirContent
──────────────────────────────────────────────────────────── */
function MemoirContent() {
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("projectId");

  const [modalOpen, setModalOpen]           = useState(false);
  const [project, setProject]               = useState<ProjectData | null>(null);
  const [progress, setProgress]             = useState<ProgressData | null>(null);
  const [reviews, setReviews]               = useState<ProjectReview[]>([]);
  const [growth, setGrowth]                 = useState<GrowthData | null>(null);
  const [memoirList, setMemoirList]         = useState<MemoirOverviewItem[]>([]);
  const [retrospectiveId, setRetrospectiveId] = useState<number | null>(null);
  const [harvestCount, setHarvestCount]     = useState(1); // 몇 번째 수확
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [generatingMemoir, setGeneratingMemoir] = useState(false);
  const [error, setError]                   = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadMemoir() {
      try {
        setLoading(true);
        setError("");

        let selectedProject: ProjectData | null = null;

        if (!requestedProjectId) {
          const myProjectsResult = await getMyProjectsApi();
          const completedProjects = (myProjectsResult.data || []).filter(
            (p: ProjectData) => p.status === "completed"
          );

          const overviewItems = await Promise.all(
            completedProjects.map(async (completedProject: ProjectData) => {
              try {
                const retrospectivesResult = await getProjectRetrospectivesApi(
                  completedProject.id
                );
                const first = (retrospectivesResult.data || [])[0] as
                  | RetrospectiveSummary
                  | undefined;

                if (!first) {
                  return {
                    project: completedProject,
                    retrospectiveId: null,
                    growth: null,
                  };
                }

                const detail = await getProjectRetrospectiveApi(
                  completedProject.id,
                  first.id
                );
                const retro = detail.data as RetrospectiveDetail;
                const ll = parseLessonsLearned(retro.lessons_learned);

                return {
                  project: completedProject,
                  retrospectiveId: retro.id,
                  growth: {
                    chips: ll.chips,
                    good: retro.what_went_well || "",
                    bad: retro.what_went_badly || "",
                    lessons: ll.lessons,
                    nextActions: retro.next_actions || "",
                  },
                };
              } catch {
                return {
                  project: completedProject,
                  retrospectiveId: null,
                  growth: null,
                };
              }
            })
          );

          if (ignore) return;
          setMemoirList(overviewItems);
          setProject(null);
          return;
        }

        const [detailResult, listResult] = await Promise.allSettled([
          getProjectApi(requestedProjectId),
          getProjectsApi({ page: 1, size: 100 }),
        ]);
        if (detailResult.status === "fulfilled") selectedProject = detailResult.value.data;
        if (selectedProject && listResult.status === "fulfilled") {
          const listed = (listResult.value.data || []).find(
            (item: ProjectData) => Number(item.id) === Number(selectedProject?.id)
          );
          selectedProject = { ...listed, ...selectedProject };
        }

        if (!selectedProject) throw new Error("회고를 보여줄 프로젝트가 없습니다.");

        const projectId = selectedProject.id;

        const [progressResult, reviewsResult, retrospectivesResult, myProjectsResult] =
          await Promise.allSettled([
            getProjectProgressApi(projectId),
            getProjectReviewsApi(projectId),
            getProjectRetrospectivesApi(projectId),
            getMyProjectsApi(),
          ]);

        // 몇 번째 수확인지 계산 (completed 프로젝트 수)
        if (myProjectsResult.status === "fulfilled") {
          const completed = (myProjectsResult.value.data || []).filter(
            (p: ProjectData) => p.status === "completed"
          );
          const idx = completed.findIndex((p: ProjectData) => Number(p.id) === Number(projectId));
          setHarvestCount(idx >= 0 ? idx + 1 : completed.length || 1);
        }

        let loadedGrowth: GrowthData | null = null;
        let loadedRetrospectiveId: number | null = null;

        if (retrospectivesResult.status === "fulfilled") {
          const first = (retrospectivesResult.value.data || [])[0] as RetrospectiveSummary | undefined;
          if (first) {
            const detail = await getProjectRetrospectiveApi(projectId, first.id);
            const retro  = detail.data as RetrospectiveDetail;
            const ll     = parseLessonsLearned(retro.lessons_learned);
            loadedRetrospectiveId = retro.id;
            loadedGrowth = {
              chips: ll.chips,
              good: retro.what_went_well || "",
              bad: retro.what_went_badly || "",
              lessons: ll.lessons,
              aiMemoir: ll.aiMemoir,
              nextActions: retro.next_actions || "",
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
    return () => { ignore = true; };
  }, [requestedProjectId]);

  const rating = useMemo<Rating>(() => ({
    avg_contribution:   average(reviews.map((r) => Number(r.contribution_score  || 0)).filter(Boolean)),
    avg_responsibility: average(reviews.map((r) => Number(r.responsibility_score || 0)).filter(Boolean)),
    avg_teamwork:       average(reviews.map((r) => Number(r.teamwork_score       || 0)).filter(Boolean)),
  }), [reviews]);

  const todoTotal    = progress?.todo_total    ?? 0;
  const todoDone     = progress?.todo_done     ?? 0;
  const todoPercent  = Math.round(progress?.progress_percent ?? 0);
  const durationDays = daysBetween(project?.created_at);
  const hours        = durationDays * 6;
  const techStack    = project?.techStack?.length ? project.techStack : [project?.category || "프로젝트"];

  async function handleSaveGrowth(data: GrowthData) {
    if (!project) return;
    try {
      setSaving(true);
      const payload = {
        title: `${project.title} 회고`,
        what_went_well:  data.good,
        what_went_badly: data.bad,
        lessons_learned: stringifyLessonsLearned(data),
        next_actions:    data.nextActions || data.lessons || "",
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

  async function handleGenerateMemoir(data: GrowthData) {
    if (!project) throw new Error("프로젝트 정보가 없습니다.");

    try {
      setGeneratingMemoir(true);
      const result = await refineProjectMemoirApi(project.id, {
        felt_point: [data.good, data.lessons, data.nextActions]
          .filter((value) => value?.trim())
          .join("\n\n")
          .trim(),
        lacked_point: data.bad.trim(),
      });
      const refined = result.data?.refined_memoir?.trim();
      if (!refined) throw new Error("AI 회고록 응답이 비어 있습니다.");
      return refined;
    } finally {
      setGeneratingMemoir(false);
    }
  }

  /* AI 정제 느낀 점 (프리뷰와 동일 멘트) */
  function buildFeelingText(): React.ReactNode {
    if (!growth) return null;
    if (growth.aiMemoir?.trim()) {
      return growth.aiMemoir.split("\n").filter(Boolean).map((line, index) => (
        <p key={`ai-${index}`} style={{ margin: index === 0 ? "0 0 14px" : "0 0 14px" }}>
          {line}
        </p>
      ));
    }

    const parts: React.ReactNode[] = [];
    if (growth.good.trim()) {
      const s = growth.good.length > 40 ? growth.good.slice(0, 40) + "..." : growth.good;
      parts.push(
        <p key="good" style={{ margin: "0 0 14px" }}>
          이번 프로젝트에서 가장 값진 순간은 <strong>{s}</strong>이었어요.{" "}
          그 경험이 앞으로의 성장에 단단한 뿌리가 될 거예요.
        </p>
      );
    }
    if (growth.bad.trim()) {
      const s = growth.bad.length > 40 ? growth.bad.slice(0, 40) + "..." : growth.bad;
      parts.push(
        <p key="bad" style={{ margin: "0 0 14px" }}>
          <strong>{s}</strong> 부분이 아쉬웠지만, 이를 인식하는 것 자체가 이미 한 뼘 자란 증거예요.
        </p>
      );
    }
    if (growth.nextActions?.trim() || growth.lessons?.trim()) {
      parts.push(
        <p key="next" style={{ margin: "0 0 14px" }}>
          {growth.nextActions || growth.lessons}
        </p>
      );
    }
    parts.push(
      <p key="closing" style={{ margin: 0 }}>
        씨앗을 심는 사람만이 열매를 맛볼 수 있어요. 당신은 이미 훌륭한 개발자의 텃밭을 가꾸고 있어요. 🌹
      </p>
    );
    return parts;
  }

  /* 로딩 / 에러 */
  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontSize: 14, color: "#64748b" }}>
        회고 데이터를 불러오는 중이에요 🌹
      </div>
    );
  }

  if (!requestedProjectId) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 1152, margin: "0 auto" }}>
          <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: "32px 36px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
            <p style={{ color: "#e60012", fontSize: 14, fontWeight: 800, margin: 0 }}>
              나의 회고
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: 34, lineHeight: 1.25, fontWeight: 900 }}>
              완료한 프로젝트에서 남긴 성장 기록
            </h1>
            <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 15 }}>
              지금까지 완료한 프로젝트의 텃밭일기를 한눈에 모아봅니다.
            </p>
          </section>

          {memoirList.length === 0 ? (
            <section style={{ marginTop: 20, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, color: "#64748b" }}>
              아직 완료한 프로젝트 회고가 없습니다.
            </section>
          ) : (
            <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
              {memoirList.map(({ project: completedProject, growth: itemGrowth }) => {
                const summaryText =
                  itemGrowth?.good ||
                  itemGrowth?.lessons ||
                  itemGrowth?.nextActions ||
                  "아직 작성된 회고 내용이 없습니다.";

                return (
                  <article
                    key={completedProject.id}
                    style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                      <div>
                        <span style={{ display: "inline-block", background: "#fee2e2", color: "#e60012", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800 }}>
                          completed
                        </span>
                        <h2 style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 900 }}>
                          {completedProject.title}
                        </h2>
                        <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.7 }}>
                          {summaryText}
                        </p>
                      </div>

                      <a
                        href={`/memoir?projectId=${completedProject.id}`}
                        style={{ flexShrink: 0, borderRadius: 12, background: "#e60012", color: "#fff", padding: "10px 14px", fontSize: 14, fontWeight: 800, textDecoration: "none" }}
                      >
                        회고 보기
                      </a>
                    </div>

                    {itemGrowth?.chips?.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                        {itemGrowth.chips.map((chip) => (
                          <span key={chip} style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 700 }}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", textAlign: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", padding: 28, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>회고를 불러오지 못했어요</p>
          <p style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>{error || "프로젝트 정보가 없습니다."}</p>
        </div>
      </div>
    );
  }

  /* ── 프로젝트 설명 AI 정제: <b> 태그 없이 plain text 렌더 ── */
  const projectDesc = (project.description || project.summary || "")
    .replace(/<[^>]*>/g, ""); // 혹시 남아있는 HTML 태그 제거

  return (
    <>
      <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 1152, margin: "0 auto" }}>

        {/* ── Hero ── */}
        <section style={{ position: "relative", overflow: "hidden", background: "#fff", padding: "34px 36px", border: "1px solid #e2e8f0", borderRadius: 18, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
          <div style={{ position: "absolute", right: -10, bottom: -30, opacity: 0.13, transform: "scale(1.45)" }}>
            <RoseSVG />
          </div>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-block", background: "#fee2e2", color: "#e60012", fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 999, marginBottom: 14 }}>
              개발자의 장미 기록
            </div>
            <p style={{ fontSize: 34, fontWeight: 900, color: "#0f172a", marginBottom: 8, lineHeight: 1.25 }}>
              {project.title}
            </p>
            <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>프로젝트를 지나온 흔적을 차분히 남겨요.</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "7px 14px", fontSize: 13, color: "#475569", marginTop: 18 }}>
              {toDateLabel(project.created_at)} 시작 · {durationDays}일간의 여정
            </div>
          </div>
        </section>

        {/* 1. 할 일 달성 */}
        <Section emoji="✅" label="할 일 달성" headline={<>나는 {todoDone}개의 할 일을<br />달성했어요</>}>
          <p style={{ fontSize: 48, fontWeight: 900, color: "#9b1c1c", lineHeight: 1, margin: 0 }}>
            {todoDone}
            <span style={{ fontSize: 16, color: "#c06060", marginLeft: 4 }}>개 완료</span>
          </p>
          <div style={{ height: 12, background: "#fce8e8", borderRadius: 12, overflow: "hidden", margin: "12px 0 5px", border: "1px solid #f0c0c0" }}>
            <div style={{ height: "100%", background: "#c0392b", borderRadius: 12, width: `${todoPercent}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#c08080" }}>
            <span>전체 {todoTotal}개 중</span>
            <span style={{ color: "#9b1c1c", fontWeight: 700 }}>{todoPercent}% 달성 🎉</span>
          </div>
        </Section>

        {/* 2. 나는 이런 사람이었어요 */}
        <Section emoji="🌹" label="팀원 리뷰 기반" headline="나는 이런 사람이었어요">
          <ReviewSection rating={rating} />
        </Section>

        {/* 3. 이런 프로젝트를 만들었어요 */}
        <Section emoji="🗺️" label="프로젝트 소개" headline={<>나는 이런 프로젝트를<br />만들었어요</>}>
          <div style={{ fontSize: 14, color: "#7a3030", lineHeight: 1.9, background: "#fdf6f6", borderLeft: "3px solid #e05555", padding: "13px 16px", borderRadius: "0 12px 12px 0" }}>
            {projectDesc || "프로젝트 설명이 아직 없어요."}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
            {techStack.map((tag) => (
              <span key={tag} style={{ background: "#fce8e8", color: "#9b1c1c", fontSize: 12, padding: "5px 12px", borderRadius: 20, border: "1px solid #f0c0c0" }}>
                {tag}
              </span>
            ))}
          </div>
        </Section>

        {/* 4. n시간 동안 수행했어요 */}
        <Section emoji="⏱️" label="투자한 시간" headline={<>나는 약 {hours}시간 동안<br />프로젝트를 수행했어요</>}>
          <p style={{ fontSize: 52, fontWeight: 900, color: "#9b1c1c", lineHeight: 1, margin: 0 }}>
            {hours}
            <span style={{ fontSize: 18, color: "#c06060", marginLeft: 6 }}>시간</span>
          </p>
          <p style={{ fontSize: 13, color: "#c08080", marginTop: 5 }}>{durationDays}일 × 하루 평균 6시간 기준</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            {[
              { val: `${durationDays}일`, label: "총 프로젝트 기간" },
              { val: `${Math.ceil(durationDays / 7)}주`, label: "함께한 기간" },
            ].map(({ val, label }) => (
              <div key={label} style={{ background: "#fdf4f4", border: "1px solid #f0cccc", borderRadius: 12, padding: 12, textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#9b1c1c", margin: 0 }}>{val}</p>
                <p style={{ fontSize: 11, color: "#c08080", marginTop: 3 }}>{label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. 이만큼 성장했어요 */}
        <Section emoji="🌺" label="나의 성장" headline="나는 이만큼 성장했어요">
          {!growth ? (
            <div
              onClick={() => setModalOpen(true)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 16px", gap: 10, cursor: "pointer", border: "2px dashed #f0b0b0", borderRadius: 14, background: "#fdf8f8", textAlign: "center" }}
            >
              <span style={{ fontSize: 32 }}>✍️</span>
              <div style={{ fontSize: 14, color: "#a83030", lineHeight: 1.7 }}>
                새롭게 도전한 것들을 기록해봐요<br />
                <span style={{ fontSize: 12, color: "#c08080" }}>기술 스택, 분야, 느낀 점을 담을 수 있어요</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, color: "#c08080", marginBottom: 8 }}>새롭게 도전한 것들</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {growth.chips.map((c) => (
                    <span key={c} style={{ background: "#fce8e8", color: "#9b1c1c", fontSize: 12, padding: "5px 13px", borderRadius: 20, border: "1px solid #f0c0c0" }}>{c}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                style={{ alignSelf: "flex-start", fontSize: 12, color: "#a83030", background: "none", border: "1px solid #f0c0c0", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}
              >
                ✏️ 수정하기
              </button>
            </div>
          )}
        </Section>

        {/* 6. 이런 점을 느꼈어요 */}
        <Section emoji="💬" label="AI 정제 회고" headline="나는 이런 점을 느꼈어요">
          {!growth || (!growth.good.trim() && !growth.bad.trim() && !growth.nextActions?.trim() && !growth.lessons?.trim()) ? (
            <p style={{ textAlign: "center", padding: 18, color: "#c08080", fontSize: 13, lineHeight: 1.9, margin: 0 }}>
              위에서 성장 기록을 작성하면<br />AI가 느낀 점을 정리해드려요 🌹
            </p>
          ) : (
            <div style={{ background: "#fdf4f4", border: "1px solid #f0cccc", borderRadius: 14, padding: 18, position: "relative", overflow: "hidden" }}>
              <span style={{ fontSize: 90, color: "#f0cccc", position: "absolute", top: -12, left: 10, lineHeight: 1 }}>&quot;</span>
              <div style={{ fontSize: 14, color: "#6b2020", lineHeight: 1.9, position: "relative", zIndex: 1, paddingLeft: 8 }}>
                {buildFeelingText()}
              </div>
              <span style={{ display: "inline-block", background: "rgba(155,28,28,0.1)", color: "#9b1c1c", fontSize: 11, padding: "4px 10px", borderRadius: 20, marginTop: 12 }}>
                ✨ AI가 정성껏 정리했어요
              </span>
            </div>
          )}
        </Section>

        {/* Footer — 장미 SVG + n번째 수확 */}
        <div style={{ margin: "24px 0 0", textAlign: "center", padding: "28px 20px 24px", background: "#991b1b", borderRadius: 18, color: "#fdf0f0", border: "1px solid #7f1d1d" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "50%", padding: 16, display: "inline-flex" }}>
              <RoseSVG />
            </div>
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            {ordinalKo(harvestCount)} 수확을 축하해요!
          </p>
          <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.8, margin: 0 }}>
            씨앗을 심고 꾸준히 가꾼 당신,<br />이 텃밭일지는 영원히 남아있을 거예요.
          </p>
        </div>

        {/* 모달 */}
        {modalOpen && (
          <GrowthModal
            initialData={growth}
            saving={saving}
            generating={generatingMemoir}
            onClose={() => setModalOpen(false)}
            onSave={handleSaveGrowth}
            onGenerate={handleGenerateMemoir}
          />
        )}
      </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   export
──────────────────────────────────────────────────────────── */
export default function MemoirPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontSize: 14, color: "#64748b" }}>
          회고 데이터를 준비하는 중이에요 🌹
        </div>
      }
    >
      <MemoirContent />
    </Suspense>
  );
}
