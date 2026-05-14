"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProjectApi,
  applyProjectApi,
  getMyProfileApi,
  updateProjectApi,
  deleteProjectApi,
  revertProjectToIdeaApi,
  getMyApplicationsApi,
  createReportApi,
  boostProjectApi,
  getMyEntitlementApi,
} from "../../../lib/api";
import { INTERESTS_LIST, SKILLS_LIST } from "../../../lib/profileOptions";
import { useDialog, useToast } from "../../../components/AppFeedback";
import { confirmWaterdropSpend } from "../../../lib/waterdrops";

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
];

const CATEGORY_OPTIONS = [
  "IT/SW",
  "경영/경제",
  "디자인/UI·UX",
  "AI/데이터",
  "교육/학습",
  "금융/핀테크",
  "커머스/쇼핑",
  "소셜/커뮤니티",
  "헬스케어",
];

const getOptionKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");

const toOptionArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",");
  return [];
};

const hasSelectableValue = (value) =>
  toOptionArray(value).some((item) => String(item || "").trim());

const normalizeSelectableValues = (value, options) => {
  const optionByKey = new Map(options.map((option) => [getOptionKey(option), option]));
  const seen = new Set();

  return toOptionArray(value).reduce((items, item) => {
    const trimmed = String(item || "").trim();
    if (!trimmed) return items;

    const canonical = optionByKey.get(getOptionKey(trimmed)) || trimmed;
    const key = getOptionKey(canonical);
    if (seen.has(key)) return items;

    seen.add(key);
    items.push(canonical);
    return items;
  }, []);
};

const toggleSelectableValue = (current, nextValue, options) => {
  const normalized = normalizeSelectableValues(current, options);
  const nextKey = getOptionKey(nextValue);
  const isSelected = normalized.some((item) => getOptionKey(item) === nextKey);

  return isSelected
    ? normalized.filter((item) => getOptionKey(item) !== nextKey)
    : [...normalized, nextValue];
};

const getProjectMemberUserId = (member) => member.user_id || member.id || member.user?.id;

const getProjectMemberDisplayName = (member) => {
  const userId = getProjectMemberUserId(member);

  return (
    member.nickname ||
    member.user?.nickname ||
    member.name ||
    member.user?.name ||
    `User #${userId}`
  );
};

const isProEntitlement = (entitlement) =>
  ["PRO_MONTHLY", "PRO"].includes(
    String(entitlement?.plan || entitlement?.product_code || "").toUpperCase()
  );

function formatBoostedUntil(value) {
  if (!value) return "";

  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { prompt, confirm, confirmCoinSpend } = useDialog();
  const projectId = params.projectId;

  const [project, setProject] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const [message, setMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [myApplication, setMyApplication] = useState(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const [showDiscardOptions, setShowDiscardOptions] = useState(false);
  const [nowTime, setNowTime] = useState(() => Date.now());

  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    description: "",
    difficulty: "",
    category: "",
    progress_percent: 0,
    max_members: 10,
    expected_period: "",
    preferred_members: "",
    tech_stack: [],
    interests: [],
    hashtags: "",
    is_public: true,
  });

  const textareaClassName =
    "mt-4 min-h-32 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  const inputClassName =
    "w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  const buildEditFormFromProject = (projectData) => {
    const techStackValue = hasSelectableValue(projectData.tech_stack)
      ? projectData.tech_stack
      : projectData.techStack;

    return {
      title: projectData.title || "",
      summary: projectData.summary || "",
      description: projectData.description || "",
      difficulty: projectData.difficulty || "",
      category: projectData.category || projectData.domain || "",
      progress_percent: projectData.progress_percent ?? 0,
      max_members:
        projectData.max_members ??
        projectData.maxMembers ??
        projectData.recruitment_count ??
        projectData.member_limit ??
        "",
      expected_period: projectData.expected_period || "",
      preferred_members: projectData.preferred_members || "",
      tech_stack: normalizeSelectableValues(techStackValue, SKILLS_LIST),
      interests: normalizeSelectableValues(projectData.interests, INTERESTS_LIST),
      hashtags: (projectData.hashtags || projectData.hash_tags || []).join(", "),
      is_public: projectData.is_public ?? true,
    };
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [projectId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTime(Date.now()), 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function fetchProject() {
      try {
        const [projectResult, profileResult, applicationsResult] = await Promise.allSettled([
          getProjectApi(projectId),
          getMyProfileApi(),
          getMyApplicationsApi(),
        ]);

        if (projectResult.status !== "fulfilled") {
          throw projectResult.reason;
        }

        const projectData = projectResult.value.data;

        setProject(projectData);
        setMyProfile(
          profileResult.status === "fulfilled" ? profileResult.value.data : null
        );
        setMyApplication(
          applicationsResult.status === "fulfilled"
            ? (applicationsResult.value.data || []).find(
                (application) =>
                  String(application.project_id) === String(projectId)
              ) || null
            : null
        );

        setEditForm(buildEditFormFromProject(projectData));
      } catch (error) {
        console.error(error);
        alert("프로젝트 정보를 불러오지 못했습니다.");
      }
    }

    fetchProject();
  }, [projectId]);

  const isLeader = project?.leader_id === myProfile?.id;
  const isProjectCompleted = project?.status === "completed";
  const isTeamFormed = ["in_progress", "started", "completed"].includes(
    String(project?.status || "").replace("-", "_")
  );
  const isProjectMember =
    project &&
    myProfile &&
    (project.leader_id === myProfile.id ||
      (project.members || []).some(
        (member) => getProjectMemberUserId(member) === myProfile.id
      ));
  const hasApplied = Boolean(myApplication);
  const acceptedMemberCount = project?.members?.length || 1;
  const boostedUntilTime = project?.boosted_until
    ? new Date(project.boosted_until).getTime()
    : 0;
  const isBoosted = Number.isFinite(boostedUntilTime) && boostedUntilTime > nowTime;

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleEditTechStack = (skill) => {
    setEditForm((prev) => {
      return {
        ...prev,
        tech_stack: toggleSelectableValue(prev.tech_stack, skill, SKILLS_LIST),
      };
    });
  };

  const toggleEditInterest = (interest) => {
    setEditForm((prev) => {
      return {
        ...prev,
        interests: toggleSelectableValue(prev.interests, interest, INTERESTS_LIST),
      };
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      alert("프로젝트 제목을 입력해주세요.");
      return;
    }

    if (!editForm.description.trim()) {
      alert("상세 설명을 입력해주세요.");
      return;
    }

    if (!editForm.category) {
      alert("프로젝트 유형을 선택해주세요.");
      return;
    }

    if (!isTeamFormed && Number(editForm.max_members) < acceptedMemberCount) {
      alert(`현재 팀원수인 ${acceptedMemberCount}명 이상으로만 변경 가능합니다.`);
      return;
    }

    try {
      setIsSavingEdit(true);

      const payload = {
        title: editForm.title,
        summary: editForm.summary,
        description: editForm.description,
        difficulty: editForm.difficulty,
        category: editForm.category,
        progress_percent: Number(editForm.progress_percent),
        expected_period: editForm.expected_period.trim(),
        preferred_members: editForm.preferred_members.trim(),
        tech_stack: normalizeSelectableValues(editForm.tech_stack, SKILLS_LIST),
        interests: normalizeSelectableValues(editForm.interests, INTERESTS_LIST),
        hashtags: editForm.hashtags
          .split(",")
          .map((item) => item.trim().replace(/^#/, ""))
          .filter(Boolean),
        is_public: editForm.is_public,
      };

      if (!isTeamFormed) {
        payload.max_members = Number(editForm.max_members);
      }

      const updateResult = await updateProjectApi(projectId, payload);

      const refreshed = await getProjectApi(projectId);
      const nextProject = {
        ...refreshed.data,
        max_members:
          refreshed.data?.max_members ??
          updateResult.data?.max_members ??
          Number(editForm.max_members),
        maxMembers:
          refreshed.data?.maxMembers ??
          updateResult.data?.maxMembers ??
          Number(editForm.max_members),
      };
      setProject(nextProject);
      setEditForm(buildEditFormFromProject(nextProject));
      setIsEditing(false);

      alert(
        isTeamFormed
          ? "프로젝트 정보가 수정되었습니다. 모집 인원은 팀 결성 완료 후 변경되지 않습니다."
          : `프로젝트 정보가 수정되었습니다. 모집 인원은 ${Number(editForm.max_members)}명입니다.`
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("current member count")) {
        alert(`모집 인원은 현재 팀원수인 ${acceptedMemberCount}명 이상이어야 합니다.`);
        return;
      }
      if (message.includes("team formation")) {
        alert("팀 결성 완료 후에는 모집 인원을 변경할 수 없습니다.");
        return;
      }
      alert(message || "프로젝트 수정에 실패했습니다.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRevertToIdea = async () => {
    if (isProjectCompleted) {
      alert("완료된 프로젝트는 버릴 수 없습니다.");
      return;
    }

    try {
      setIsDeleting(true);
      await revertProjectToIdeaApi(projectId);

      alert("프로젝트가 생각의 뜰으로 이동되었습니다.");
      router.push("/ideas/pickup");
    } catch (error) {
      console.error(error);
      alert("생각의 뜰으로 보내는 데 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (isProjectCompleted) {
      alert("완료된 프로젝트는 버릴 수 없습니다.");
      return;
    }

    const reallyDelete = await confirm({
      title: "프로젝트를 삭제할까요?",
      message: "삭제한 프로젝트는 다시 이어가기 어려워요.",
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger",
    });
    if (!reallyDelete) return;

    try {
      setIsDeleting(true);
      await deleteProjectApi(projectId);

      alert("프로젝트가 삭제되었습니다.");
      router.push("/mainpage");
    } catch (error) {
      console.error(error);
      alert("프로젝트 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReportProject = async () => {
    if (!myProfile) {
      router.push("/login");
      return;
    }

    const reasonInput = await prompt({
      title: "프로젝트 신고",
      message: "관리자가 확인할 수 있도록 신고 사유를 입력해주세요.",
      placeholder: "문제가 되는 이유를 입력하세요.",
      confirmText: "신고하기",
      required: true,
      multiline: true,
      tone: "danger",
    });
    if (reasonInput === null) return;

    try {
      await createReportApi({
        target_type: "project",
        target_id: Number(projectId),
        reason: reasonInput.trim(),
      });
      toast.success("신고가 접수되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "신고 접수에 실패했습니다.");
    }
  };

  const handleApply = async () => {
    if (hasApplied) {
      alert("이미 지원한 프로젝트입니다.");
      return;
    }

    if (!message.trim()) {
      alert("지원 메시지를 입력해주세요.");
      return;
    }

    try {
      setIsApplying(true);
      const canSpend = await confirmWaterdropSpend({
        confirmCoinSpend,
        toast,
        actionLabel: "프로젝트 지원",
      });
      if (!canSpend) return;

      const result = await applyProjectApi(projectId, message);
      setMyApplication(result.data || { project_id: Number(projectId), status: "pending" });
      alert("프로젝트 지원이 완료되었습니다.");
      setMessage("");
      setShowApplicationForm(false);
    } catch (error) {
      console.error(error);
      const errorMessage = String(error?.message || "");
      if (errorMessage.includes("Application already exists")) {
        setMyApplication({ project_id: Number(projectId), status: "pending" });
        alert("이미 지원한 프로젝트입니다.");
        return;
      }
      alert("프로젝트 지원에 실패했습니다.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleBoostProject = async () => {
    if (isBoosted) {
      const shouldBoostAgain = await confirm({
        title: "이미 거름 주기 적용 중입니다",
        message:
          "이 프로젝트에는 이미 거름을 주었어요. 다시 거름을 주면 이전 거름 주기 효과는 사라집니다. 다시 거름을 주시겠어요?",
        confirmText: "거름 주기",
        cancelText: "취소",
      });

      if (!shouldBoostAgain) return;
    }

    try {
      setIsBoosting(true);
      const entitlementResult = await getMyEntitlementApi();

      if (!isProEntitlement(entitlementResult.data)) {
        setIsBoosting(false);
        const shouldUpgrade = await confirm({
          title: "Devory Pro 전용 기능",
          message: "'Devory Pro' 구독자만 프로젝트에 거름을 줄 수 있습니다.",
          confirmText: "플랜 업그레이드하러 가기",
          cancelText: "닫기",
        });

        if (shouldUpgrade) {
          router.push("/coins");
        }
        return;
      }

      const result = await boostProjectApi(projectId);
      setProject((prev) => ({
        ...prev,
        boosted_until: result.data?.boosted_until || prev?.boosted_until,
        boost_score: result.data?.boost_score ?? prev?.boost_score,
      }));
      const remaining = result.data?.project_boost_remaining;
      setNowTime(Date.now());
      toast.success(
        typeof remaining === "number"
          ? `프로젝트에 거름을 주었습니다. 일정 기간 동안 목록 상단에 노출됩니다. 남은 횟수: ${remaining}회`
          : "프로젝트에 거름을 주었습니다. 일정 기간 동안 목록 상단에 노출됩니다."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거름 주기에 실패했습니다.");
    } finally {
      setIsBoosting(false);
    }
  };

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-600">프로젝트 정보를 불러오는 중...</p>
      </main>
    );
  }

  const projectMembers = project.members || [];
  const leaderMember = projectMembers.find(
    (member) => getProjectMemberUserId(member) === project.leader_id
  );
  const leaderDisplayName =
    leaderMember
      ? getProjectMemberDisplayName(leaderMember)
      : project.leader?.nickname || project.leader_name || `User #${project.leader_id}`;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  프로젝트 제목
                </label>
                <input
                  className={inputClassName}
                  value={editForm.title}
                  onChange={(e) => handleEditChange("title", e.target.value)}
                  placeholder="프로젝트 제목"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  한 줄 요약
                </label>
                <input
                  className={inputClassName}
                  value={editForm.summary}
                  onChange={(e) => handleEditChange("summary", e.target.value)}
                  placeholder="예: 아이디어를 공유하고 협업자를 구하는 플랫폼"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  상세 설명
                </label>
                <textarea
                  className={textareaClassName}
                  value={editForm.description}
                  onChange={(e) => handleEditChange("description", e.target.value)}
                  placeholder="아이디어의 목적, 주요 기능, 필요한 역할 등을 설명해주세요."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    난이도
                  </label>
                  <select
                    className={inputClassName}
                    value={editForm.difficulty}
                    onChange={(e) => handleEditChange("difficulty", e.target.value)}
                  >
                    <option value="">난이도를 선택해주세요</option>
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    프로젝트 유형
                  </label>
                  <select
                    className={inputClassName}
                    value={editForm.category}
                    onChange={(e) => handleEditChange("category", e.target.value)}
                  >
                    <option value="">프로젝트 유형을 선택해주세요</option>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    모집 인원 (리더 포함) (최대 인원: 100명)
                  </label>
                  <input
                    className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
                    type="number"
                    min={acceptedMemberCount}
                    max="100"
                    value={editForm.max_members}
                    disabled={isTeamFormed}
                    onChange={(e) => handleEditChange("max_members", e.target.value)}
                    placeholder="모집 인원 (리더 포함)"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {isTeamFormed
                      ? "팀 결성 완료 후에는 모집 인원을 변경할 수 없습니다."
                      : `리더 포함 총 인원입니다. ${acceptedMemberCount}명(현재 팀원수) 이상으로만 설정할 수 있습니다.`}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    예상 진행 기간
                  </label>
                  <input
                    className={inputClassName}
                    value={editForm.expected_period}
                    onChange={(e) => handleEditChange("expected_period", e.target.value)}
                    placeholder="예: 3개월, 한 학기, 2026년 3월까지"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  이런 분과 함께하고 싶어요
                </label>
                <textarea
                  className="mt-4 min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  value={editForm.preferred_members}
                  onChange={(e) => handleEditChange("preferred_members", e.target.value)}
                  placeholder="예: 백엔드 경험이 있는 분, 주 1회 이상 회의 가능한 분, 꾸준히 소통 가능한 분"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  기술 스택{" "}
                  <span className="font-normal text-slate-400">
                    ({Array.isArray(editForm.tech_stack) ? editForm.tech_stack.length : 0}개 선택)
                  </span>
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SKILLS_LIST.map((skill) => {
                    const selected = Array.isArray(editForm.tech_stack)
                      ? editForm.tech_stack.some((item) => getOptionKey(item) === getOptionKey(skill))
                      : false;

                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleEditTechStack(skill)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                          selected
                            ? "border-red-600 bg-red-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  해시태그
                </label>
                <input
                  className={inputClassName}
                  value={editForm.hashtags}
                  onChange={(e) => handleEditChange("hashtags", e.target.value)}
                  placeholder="예: 협업, 초보환영, AI추천"
                />
                <p className="mt-1 text-xs text-slate-500">
                  쉼표로 구분해서 입력해주세요.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  추천 관심분야{" "}
                  <span className="font-normal text-slate-400">
                    ({Array.isArray(editForm.interests) ? editForm.interests.length : 0}개 선택)
                  </span>
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {INTERESTS_LIST.map((interest) => {
                    const selected = Array.isArray(editForm.interests)
                      ? editForm.interests.some((item) => getOptionKey(item) === getOptionKey(interest))
                      : false;

                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleEditInterest(interest)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                          selected
                            ? "border-red-600 bg-red-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
                >
                  {isSavingEdit ? "저장 중..." : "수정 저장하기"}
                </button>

                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                  {project.status}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  난이도 {project.difficulty}
                </span>
              </div>

              <h1 className="text-3xl font-bold text-slate-900">
                {project.title}
              </h1>

              <p className="mt-3 text-lg text-slate-600">{project.summary}</p>

              {(isLeader || isProjectMember) && (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {isLeader && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      수정하기
                    </button>
                  )}

                  {isLeader && !isProjectCompleted && (
                    <button
                      onClick={() => setShowDiscardOptions(true)}
                      disabled={isDeleting}
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isDeleting ? "처리 중..." : "버리기"}
                    </button>
                  )}

                  {isLeader && !isProjectCompleted && (
                    <button
                      onClick={handleBoostProject}
                      disabled={isBoosting}
                      className="group relative inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBoosting ? "거름 주는 중..." : "거름 주기"}
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                        거름을 주면 프로젝트가 일정 기간 동안 목록 상단에 노출됩니다.
                      </span>
                    </button>
                  )}

                  {isProjectMember && isTeamFormed && (
                    <button
                      onClick={() => router.push(`/projects/${projectId}/manage`)}
                      className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-200 transition hover:bg-red-100"
                    >
                      진행 관리
                    </button>
                  )}

                  {isProjectMember && (
                    <button
                      onClick={() => router.push(`/projects/${projectId}/chat`)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      팀 채팅방
                    </button>
                  )}
                </div>
              )}

              {!isLeader && (
                <button
                  onClick={handleReportProject}
                  className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-600"
                >
                  프로젝트 신고
                </button>
              )}

              {isBoosted && (
                <p className="mt-3 text-sm font-semibold text-amber-700">
                  거름 주기 적용 중 · {formatBoostedUntil(project.boosted_until)}까지 상단 노출
                </p>
              )}
            </>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">프로젝트 설명</h2>
            <div
              className="mt-4 whitespace-pre-line leading-7 text-slate-700"
              dangerouslySetInnerHTML={{
                __html: project.description?.replace(/\n/g, "<br />"),
              }}
            />

            {(project.expected_period || project.preferred_members) && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {project.expected_period && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      예상 진행 기간
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {project.expected_period}
                    </p>
                  </div>
                )}

                {project.preferred_members && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      이런 분과 함께하고 싶어요
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                      {project.preferred_members}
                    </p>
                  </div>
                )}
              </div>
            )}

            {((project.tech_stack || project.techStack || []).length > 0 ||
              (project.interests || []).length > 0 ||
              (project.hashtags || []).length > 0) && (
              <div className="mt-6 space-y-3">
                {(project.tech_stack || project.techStack || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      기술 스택
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(project.tech_stack || project.techStack || []).map((tech) => (
                        <span
                          key={tech}
                          className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(project.interests || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      추천 관심분야
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(project.interests || []).map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(project.hashtags || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      해시태그
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(project.hashtags || []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">팀 정보</h2>

              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  리더:{" "}
                  <button
                    onClick={() => router.push(`/users/${project.leader_id}`)}
                    className="font-semibold text-slate-900 transition hover:text-red-600 hover:underline"
                  >
                    {leaderDisplayName}
                  </button>
                </p>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    참여 멤버
                  </p>

                  <div className="space-y-2">
                    {projectMembers.map((member) => {
                      const memberUserId = getProjectMemberUserId(member);

                      return (
                        <div
                          key={`${memberUserId}-${member.role_in_project}`}
                          className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/users/${memberUserId}`);
                              }}
                              className="font-semibold text-slate-900 transition hover:text-red-600 hover:underline"
                            >
                              {getProjectMemberDisplayName(member)}
                            </button>

                            <span className="text-slate-500">
                              · {member.role_in_project}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {isLeader ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  지원자 관리
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  이 프로젝트에 지원한 사람들을 확인하고 팀원을 확정할 수 있습니다.
                </p>

                <button
                  onClick={() => router.push(`/projects/${projectId}/manage`)}
                  className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                >
                  지원자 관리하기
                </button>
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  프로젝트 지원하기
                </h2>

                {hasApplied ? (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    이미 지원한 프로젝트입니다.
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-slate-500">
                      팀장에게 보낼 간단한 소개와 참여 의지를 적어주세요.
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowApplicationForm(true)}
                      className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                    >
                      지원서 작성하기
                    </button>
                  </>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>

      {showApplicationForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!isApplying) setShowApplicationForm(false);
            }}
          />

          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-7 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-slate-900">지원서 작성하기</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                리더가 확인할 수 있도록 자기소개, 가능한 역할, 참여 의지를 적어주세요.
              </p>
            </div>

            <textarea
              className="mt-5 min-h-64 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 저는 React 기반 UI 구현 경험이 있고, 이번 프로젝트에서는 화면 설계와 프론트엔드 개발을 맡아 기여하고 싶습니다."
            />

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowApplicationForm(false)}
                disabled={isApplying}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || !message.trim()}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isApplying ? "지원 중..." : "지원하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscardOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!isDeleting) setShowDiscardOptions(false);
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">프로젝트 버리기</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              그냥 삭제하면 이 아이디어는 사라집니다. 아이디어 씨앗을 다른 사람이 이어서 키워볼 수 있도록
              생각의 뜰에 뿌리는 선택을 추천해요.
            </p>

            <div className="mt-6 space-y-2">
              <button
                onClick={handleRevertToIdea}
                disabled={isDeleting}
                className="w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
              >
                생각의 뜰에 뿌리기
              </button>

              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="w-full rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                삭제하기
              </button>

              <button
                onClick={() => setShowDiscardOptions(false)}
                disabled={isDeleting}
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-slate-400 transition hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
