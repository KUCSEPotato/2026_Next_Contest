"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProgressBloom from "../../../../components/ProgressBloom";
import {
  getProjectApi,
  getProjectApplicationsApi,
  decideProjectApplicationApi,
  getMyProfileApi,
  completeTeamApi,
  getTodosApi,
  toggleTodoDoneApi,
  updateProjectStatusApi,
  updateTodoApi,
  createTodoApi,
  createRecruitmentApi,
  createProjectReviewApi,
  getProjectReviewsApi,
} from "../../../../lib/api";

const unwrapResponseData = (result, fallback = null) =>
  result?.data?.data ?? result?.data ?? fallback;

const normalizeStatus = (status) => String(status || "").replace("-", "_");

const isDoneTodo = (todo) =>
  normalizeStatus(todo?.status) === "done" ||
  Boolean(todo?.completed_at) ||
  todo?.is_done === true;

const getMemberUserId = (member) => member?.user_id || member?.user?.id;

const TODO_STAGES = [
  { value: "planning", label: "기획" },
  { value: "design", label: "설계" },
  { value: "development", label: "개발" },
  { value: "verification", label: "검증" },
];

export default function ProjectManagePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [isCompletingTeam, setIsCompletingTeam] = useState(false);
  const [todos, setTodos] = useState([]);
  const [todoLoading, setTodoLoading] = useState(false);
  const [togglingTodoId, setTogglingTodoId] = useState(null);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState("");
  const [editingTodoDescription, setEditingTodoDescription] = useState("");
  const [editingTodoStage, setEditingTodoStage] = useState("planning");
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDescription, setNewTodoDescription] = useState("");
  const [newTodoStage, setNewTodoStage] = useState("planning");
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [showRecruitmentForm, setShowRecruitmentForm] = useState(false);
  const [isCreatingRecruitment, setIsCreatingRecruitment] = useState(false);
  const [projectReviews, setProjectReviews] = useState([]);
  const [completionReviewOpen, setCompletionReviewOpen] = useState(false);
  const [completionReviewTargets, setCompletionReviewTargets] = useState([]);
  const [completionReviewInputs, setCompletionReviewInputs] = useState({});
  const [isSubmittingCompletionReviews, setIsSubmittingCompletionReviews] = useState(false);
  const [hasPromptedCompletionReview, setHasPromptedCompletionReview] = useState(false);
  const [recruitmentPosition, setRecruitmentPosition] = useState("");
  const [recruitmentCount, setRecruitmentCount] = useState(1);
  const [recruitmentSummary, setRecruitmentSummary] = useState("");
  const [recruitmentDescription, setRecruitmentDescription] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [projectResult, profileResult, applicationsResult, todosResult] =
          await Promise.all([
            getProjectApi(projectId),
            getMyProfileApi(),
            getProjectApplicationsApi(projectId).catch(() => ({ data: [] })),
            getTodosApi(projectId),
          ]);
        const reviewsResult = await getProjectReviewsApi(projectId).catch(() => ({
          data: [],
        }));

        setProject(projectResult.data);
        setProfile(profileResult.data);
        setApplications(applicationsResult.data || []);
        setTodos(Array.isArray(todosResult.data) ? todosResult.data : []);
        setProjectReviews(Array.isArray(reviewsResult.data) ? reviewsResult.data : []);
      } catch (error) {
        console.error(error);
        alert("프로젝트 관리 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const isLeader = project && profile && project.leader_id === profile.id;
  const isProjectMember =
    project &&
    profile &&
    (project.leader_id === profile.id ||
      (project.members || []).some((member) => getMemberUserId(member) === profile.id));

  const acceptedCount = applications.filter(
    (application) => application.status === "accepted"
  ).length;

  const maxMembers = project?.maxMembers ?? project?.max_members ?? 0;
  const currentMemberCount =
    project?.currentMembers ?? project?.current_members ?? project?.members?.length ?? 1;
  const displayCurrentMemberCount = Math.max(currentMemberCount, acceptedCount + 1);
  const canAcceptMore = !maxMembers || displayCurrentMemberCount < maxMembers;
  const projectStatus = normalizeStatus(project?.status);
  const isProjectInProgress = ["in_progress", "started"].includes(projectStatus);
  const doneTodoCount = todos.filter(isDoneTodo).length;
  const todoCompletionRate = todos.length
    ? Math.round((doneTodoCount / todos.length) * 100)
    : 0;
  const canCompleteProject =
    isProjectInProgress && todos.length > 0 && todoCompletionRate >= 70;
  const isProjectCompleted = projectStatus === "completed";
  const canCompleteTeam = !isProjectInProgress && !isProjectCompleted;
  const completionHelpText =
    !isProjectInProgress
      ? ""
      : todos.length === 0
        ? "Todo가 있어야 프로젝트 완료 처리를 할 수 있습니다."
      : canCompleteProject && isLeader
          ? "완료 조건을 충족했습니다. 프로젝트 완료 버튼을 눌러 마무리하세요."
          : canCompleteProject
            ? "완료 조건을 충족했습니다. 프로젝트 완료 처리는 팀장만 할 수 있습니다."
          : "Todo를 70% 이상 완료하면 프로젝트 완료 버튼을 누를 수 있습니다.";
  const todoGroups = groupTodosByStage(todos);

  const getProjectMemberIds = () =>
    (project?.members || [])
      .map(getMemberUserId)
      .filter(Boolean);

  const reloadProjectAndTodos = async () => {
    const [proj, todoResult, reviewsResult] = await Promise.all([
      getProjectApi(projectId),
      getTodosApi(projectId),
      getProjectReviewsApi(projectId).catch(() => ({ data: [] })),
    ]);

    setProject(unwrapResponseData(proj));
    setTodos(Array.isArray(todoResult.data) ? todoResult.data : []);
    setProjectReviews(Array.isArray(reviewsResult.data) ? reviewsResult.data : []);
  };

  const getPendingReviewTargets = useCallback(() => {
    if (!project || !profile) return [];

    const reviewedUserIds = new Set(
      projectReviews
        .filter((review) => review.reviewer_id === profile.id)
        .map((review) => review.reviewee_id)
    );

    return (project.members || []).filter(
      (member) => member.user_id !== profile.id && !reviewedUserIds.has(member.user_id)
    );
  }, [project, profile, projectReviews]);

  const openCompletionReview = () => {
    const targets = getPendingReviewTargets();

    if (!targets.length) {
      alert("이미 모든 팀원 평가를 완료했습니다.");
      return;
    }

    const initialInputs = {};
    targets.forEach((member) => {
      initialInputs[member.user_id] = {
        teamwork_score: 3,
        contribution_score: 3,
        responsibility_score: 3,
        comment: "",
      };
    });

    setCompletionReviewTargets(targets);
    setCompletionReviewInputs(initialInputs);
    setCompletionReviewOpen(true);
  };

  useEffect(() => {
    if (!isProjectCompleted || !isProjectMember || hasPromptedCompletionReview) {
      return;
    }

    const targets = getPendingReviewTargets();
    if (!targets.length) return;

    const initialInputs = {};
    targets.forEach((member) => {
      initialInputs[member.user_id] = {
        teamwork_score: 3,
        contribution_score: 3,
        responsibility_score: 3,
        comment: "",
      };
    });
    window.setTimeout(() => {
      setHasPromptedCompletionReview(true);
      setCompletionReviewTargets(targets);
      setCompletionReviewInputs(initialInputs);
      setCompletionReviewOpen(true);
    }, 0);
  }, [isProjectCompleted, isProjectMember, hasPromptedCompletionReview, getPendingReviewTargets]);

  const handleDecision = async (applicationId, status) => {
    if (!isLeader) {
      alert("지원자 처리는 팀장만 할 수 있습니다.");
      return;
    }

    if (status === "accepted" && !canAcceptMore) {
      alert("모집 인원을 초과할 수 없습니다.");
      return;
    }

    try {
      setProcessingId(applicationId);

      await decideProjectApplicationApi(projectId, applicationId, {
        status,
        role_in_project: "member",
      });

      const [apps, proj] = await Promise.all([
        getProjectApplicationsApi(projectId),
        getProjectApi(projectId),
      ]);

      setApplications(unwrapResponseData(apps, []));
      setProject(unwrapResponseData(proj));

      alert(status === "accepted" ? "지원자를 승인했습니다." : "지원자를 거절했습니다.");
    } catch (error) {
      console.error(error);
      alert("지원 상태 변경에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteTeam = async () => {
    if (!isLeader) {
      alert("팀 결성은 팀장만 할 수 있습니다.");
      return;
    }

    if (!confirm("팀 결성을 완료하고 프로젝트를 시작할까요?")) {
      return;
    }

    try {
      setIsCompletingTeam(true);

      await completeTeamApi(projectId);

      const proj = await getProjectApi(projectId);
      setProject(unwrapResponseData(proj));

      alert("팀 결성이 완료되었습니다.");
    } catch (error) {
      console.error(error);
      alert("팀 결성에 실패했습니다.");
    } finally {
      setIsCompletingTeam(false);
    }
  };

  const handleToggleTodo = async (todoId) => {
    try {
      setTogglingTodoId(todoId);
      await toggleTodoDoneApi(projectId, todoId);
      const todoResult = await getTodosApi(projectId);
      setTodos(Array.isArray(todoResult.data) ? todoResult.data : []);
    } catch (error) {
      console.error(error);
      alert("Todo 완료 상태를 변경하지 못했습니다.");
    } finally {
      setTogglingTodoId(null);
    }
  };

  const startEditingTodo = (todo) => {
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title || "");
    setEditingTodoDescription(todo.description || "");
    setEditingTodoStage(normalizeTodoStage(todo.stage));
  };

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditingTodoTitle("");
    setEditingTodoDescription("");
    setEditingTodoStage("planning");
  };

  const handleCreateTodo = async () => {
    if (!newTodoTitle.trim()) {
      alert("Todo 제목을 입력해주세요.");
      return;
    }

    try {
      setIsCreatingTodo(true);
      await createTodoApi(projectId, {
        title: newTodoTitle.trim(),
        description: newTodoDescription.trim() || null,
        stage: newTodoStage,
        status: "todo",
        priority: todos.length + 1,
        assignee_ids: getProjectMemberIds(),
      });

      setNewTodoTitle("");
      setNewTodoDescription("");
      setNewTodoStage("planning");
      const todoResult = await getTodosApi(projectId);
      setTodos(Array.isArray(todoResult.data) ? todoResult.data : []);
    } catch (error) {
      console.error(error);
      alert("Todo 생성에 실패했습니다.");
    } finally {
      setIsCreatingTodo(false);
    }
  };

  const handleSaveTodoEdit = async (todo) => {
    if (!editingTodoTitle.trim()) {
      alert("Todo 제목을 입력해주세요.");
      return;
    }

    try {
      setTodoLoading(true);
      await updateTodoApi(projectId, todo.id, {
        title: editingTodoTitle.trim(),
        description: editingTodoDescription.trim() || null,
        stage: editingTodoStage,
      });
      cancelEditingTodo();
      const todoResult = await getTodosApi(projectId);
      setTodos(Array.isArray(todoResult.data) ? todoResult.data : []);
    } catch (error) {
      console.error(error);
      alert("Todo 수정에 실패했습니다.");
    } finally {
      setTodoLoading(false);
    }
  };

  const updateCompletionReviewInput = (userId, field, value) => {
    setCompletionReviewInputs((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const submitCompletionReviews = async () => {
    if (!completionReviewTargets.length) return;

    try {
      setIsSubmittingCompletionReviews(true);

      for (const target of completionReviewTargets) {
        const input = completionReviewInputs[target.user_id] || {
          teamwork_score: 3,
          contribution_score: 3,
          responsibility_score: 3,
          comment: "",
        };

        await createProjectReviewApi(projectId, {
          reviewee_id: target.user_id,
          teamwork_score: Number(input.teamwork_score),
          contribution_score: Number(input.contribution_score),
          responsibility_score: Number(input.responsibility_score),
          comment: input.comment,
        }).catch((error) => {
          if (!String(error?.message || "").includes("Review already exists")) {
            throw error;
          }
        });
      }

      await reloadProjectAndTodos();
      setCompletionReviewOpen(false);
      setCompletionReviewTargets([]);
      setCompletionReviewInputs({});
      alert("팀원 평가가 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("팀원 평가 저장에 실패했습니다.");
    } finally {
      setIsSubmittingCompletionReviews(false);
    }
  };

  const handleCompleteProject = async () => {
    if (!isLeader) {
      alert("프로젝트 완료 처리는 팀장만 할 수 있습니다.");
      return;
    }

    if (!canCompleteProject) return;

    if (!confirm("프로젝트를 완료 처리할까요? 완료 후 회고록을 작성할 수 있습니다.")) {
      return;
    }

    try {
      setIsCompletingTeam(true);
      await updateProjectStatusApi(projectId, "completed");
      await reloadProjectAndTodos();
      alert("프로젝트가 완료되었습니다. 함께한 팀원 평가를 남겨주세요.");
      setHasPromptedCompletionReview(true);
      setTimeout(() => {
        openCompletionReview();
      }, 0);
    } catch (error) {
      console.error(error);
      alert("프로젝트 완료 처리에 실패했습니다.");
    } finally {
      setIsCompletingTeam(false);
    }
  };

  const handleCreateRecruitment = async () => {
    if (!isLeader) {
      alert("재모집 등록은 팀장만 할 수 있습니다.");
      return;
    }

    if (!recruitmentPosition.trim()) {
      alert("재모집 포지션을 입력해주세요.");
      return;
    }

    const count = Number(recruitmentCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      alert("재모집 인원은 1명 이상 20명 이하로 입력해주세요.");
      return;
    }

    const description = recruitmentDescription.trim() || recruitmentSummary.trim();
    if (!description) {
      alert("재모집 설명을 입력해주세요.");
      return;
    }

    try {
      setIsCreatingRecruitment(true);
      await createRecruitmentApi(projectId, {
        title: `${project?.title || "프로젝트"} 재모집`,
        position_name: recruitmentPosition.trim(),
        required_count: count,
        category: project?.category || null,
        difficulty: "normal",
        summary: recruitmentSummary.trim() || `${recruitmentPosition.trim()} 포지션을 재모집합니다.`,
        description,
        status: "open",
      });

      setShowRecruitmentForm(false);
      setRecruitmentPosition("");
      setRecruitmentCount(1);
      setRecruitmentSummary("");
      setRecruitmentDescription("");
      alert("재모집이 등록되었습니다. 개발의 땅에 모집중으로 표시됩니다.");
    } catch (error) {
      console.error(error);
      alert("재모집 등록에 실패했습니다.");
    } finally {
      setIsCreatingRecruitment(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">프로젝트 관리 정보를 불러오는 중...</p>
      </main>
    );
  }

  const completionReviewModal = completionReviewOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => {
          if (!isSubmittingCompletionReviews) {
            setCompletionReviewOpen(false);
          }
        }}
      />

      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">팀원 평가</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          프로젝트가 완료되었습니다. 함께한 팀원들의 협업, 기여, 책임감을 평가해주세요.
          평가는 각 사용자의 신뢰도에 반영됩니다.
        </p>

        <div className="mt-6 space-y-5">
          {completionReviewTargets.map((member) => {
            const input = completionReviewInputs[member.user_id] || {
              teamwork_score: 3,
              contribution_score: 3,
              responsibility_score: 3,
              comment: "",
            };

            return (
              <div
                key={member.user_id}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <p className="font-bold text-slate-900">
                  {member.nickname || member.user?.nickname || `User #${member.user_id}`} · {member.role_in_project}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ScoreSelect
                    label="협업"
                    value={input.teamwork_score}
                    onChange={(value) =>
                      updateCompletionReviewInput(member.user_id, "teamwork_score", value)
                    }
                  />
                  <ScoreSelect
                    label="기여"
                    value={input.contribution_score}
                    onChange={(value) =>
                      updateCompletionReviewInput(member.user_id, "contribution_score", value)
                    }
                  />
                  <ScoreSelect
                    label="책임"
                    value={input.responsibility_score}
                    onChange={(value) =>
                      updateCompletionReviewInput(member.user_id, "responsibility_score", value)
                    }
                  />
                </div>

                <textarea
                  value={input.comment}
                  onChange={(e) =>
                    updateCompletionReviewInput(member.user_id, "comment", e.target.value)
                  }
                  placeholder="함께한 경험을 짧게 남겨주세요."
                  className="mt-4 min-h-24 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setCompletionReviewOpen(false)}
            disabled={isSubmittingCompletionReviews}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            나중에 하기
          </button>
          <button
            onClick={submitCompletionReviews}
            disabled={isSubmittingCompletionReviews}
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmittingCompletionReviews ? "저장 중..." : "평가 저장"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!isProjectMember) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">접근 권한이 없습니다.</h1>
          <p className="mt-3 text-slate-500">
            이 프로젝트에 참여 중인 팀원만 진행 관리 페이지를 볼 수 있습니다.
          </p>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mt-6 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white"
          >
            프로젝트 상세로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-red-600">
            Project #{projectId}
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {project?.title || "프로젝트"} 진행 관리
          </h1>

          <p className="mt-3 text-slate-500">
            팀원들과 Todo 진행률, 작업 단계, 프로젝트 완료 상태를 함께 확인하세요.
            팀 결성, 재모집, 지원자 처리는 팀장만 할 수 있습니다.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            확정 인원: {displayCurrentMemberCount} /{" "}
            {maxMembers ? `${maxMembers}명 (리더 포함)` : "제한 없음"}
          </div>

          {isLeader && !isProjectCompleted && (
            <button
              onClick={
                isProjectInProgress
                  ? () => setShowRecruitmentForm((prev) => !prev)
                  : handleCompleteTeam
              }
              disabled={
                isCompletingTeam ||
                (!isProjectInProgress && !canCompleteTeam)
              }
              className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isProjectInProgress
                ? "재모집하기"
                : isCompletingTeam
                ? "팀 결성 중..."
                : "팀 결성하기"}
            </button>
          )}

          {isLeader && isProjectInProgress && showRecruitmentForm && (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50/40 p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    재모집 포지션
                  </label>
                  <input
                    value={recruitmentPosition}
                    onChange={(e) => setRecruitmentPosition(e.target.value)}
                    placeholder="예: 백엔드 개발자"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    모집 인원 (최대 인원: 20명)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={recruitmentCount}
                    onChange={(e) => setRecruitmentCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  한 줄 요약
                </label>
                <input
                  value={recruitmentSummary}
                  onChange={(e) => setRecruitmentSummary(e.target.value)}
                  placeholder="예: 결원 보충을 위한 백엔드 포지션 재모집"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  재모집 설명
                </label>
                <textarea
                  value={recruitmentDescription}
                  onChange={(e) => setRecruitmentDescription(e.target.value)}
                  placeholder="필요한 역할, 합류 후 맡을 일, 회의 방식 등을 적어주세요."
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowRecruitmentForm(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateRecruitment}
                  disabled={isCreatingRecruitment}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
                >
                  {isCreatingRecruitment ? "등록 중..." : "재모집 등록"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ProgressBloom progress={todoCompletionRate} size="md" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Todo 진행률 {todoCompletionRate}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {doneTodoCount} / {todos.length}개 완료
                  </p>
                  <p className="mt-1 text-xs text-rose-500">
                    프로젝트가 장미처럼 자라고 있어요.
                  </p>
                </div>
              </div>

              {isLeader && isProjectInProgress && !isProjectCompleted && (
                <button
                  onClick={handleCompleteProject}
                  disabled={isCompletingTeam || !canCompleteProject}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCompletingTeam ? "완료 처리 중..." : "프로젝트 완료"}
                </button>
              )}

              {isProjectCompleted && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={openCompletionReview}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    팀원 평가하기
                  </button>
                  <button
                    onClick={() => router.push(`/memoir?projectId=${projectId}`)}
                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    개발자의 텃밭일기
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-red-600 transition-all"
                style={{ width: `${todoCompletionRate}%` }}
              />
            </div>

            {completionHelpText && (
              <p
                className={`mt-2 text-xs ${
                  canCompleteProject && isLeader ? "text-red-600" : "text-slate-500"
                }`}
              >
                {completionHelpText}
              </p>
            )}
          </div>
        </section>

        {isLeader && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">지원자 목록</h2>

            {applications.length === 0 ? (
              <p className="mt-4 text-slate-500">아직 지원자가 없습니다.</p>
            ) : (
              <div className="mt-6 space-y-4">
                {applications.map((application) => {
                  const applicant =
                    application.applicant || application.user || application.profile;

                  return (
                    <div
                      key={application.id}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <button
                            onClick={() =>
                              router.push(`/users/${application.applicant_id}`)
                            }
                            className="text-left text-lg font-bold text-slate-900 transition hover:text-red-600 hover:underline"
                          >
                            User #{application.applicant_id}
                            {(applicant?.nickname || applicant?.name) &&
                              ` · ${applicant.nickname || applicant.name}`}
                          </button>

                          {applicant?.email && (
                            <p className="mt-1 text-sm text-slate-500">
                              {applicant.email}
                            </p>
                          )}

                          {applicant?.bio && (
                            <p className="mt-3 text-sm text-slate-700">
                              {applicant.bio}
                            </p>
                          )}

                          <p className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                            {application.message || "지원 메시지가 없습니다."}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {application.status}
                        </span>
                      </div>

                      <div className="mt-5 flex justify-end gap-2">
                        <button
                          onClick={() => handleDecision(application.id, "rejected")}
                          disabled={
                            processingId === application.id ||
                            application.status !== "pending"
                          }
                          className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          거절
                        </button>

                        <button
                          onClick={() => handleDecision(application.id, "accepted")}
                          disabled={
                            processingId === application.id ||
                            application.status !== "pending" ||
                            !canAcceptMore
                          }
                          className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          승인
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Team Todo</h2>
              <p className="mt-2 text-sm text-slate-500">
                chat 페이지에서 만든 Todo를 관리하고 완료 여부를 체크합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                {todoCompletionRate}% 완료
              </div>

              {isLeader && isProjectInProgress && !isProjectCompleted && (
                <button
                  onClick={handleCompleteProject}
                  disabled={isCompletingTeam || !canCompleteProject}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCompletingTeam ? "완료 처리 중..." : "프로젝트 완료"}
                </button>
              )}
            </div>
          </div>

          {!isProjectCompleted && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                <select
                  value={newTodoStage}
                  onChange={(e) => setNewTodoStage(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  {TODO_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>

                <input
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && !isCreatingTodo) {
                      handleCreateTodo();
                    }
                  }}
                  placeholder="새 Todo 제목"
                  className="min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />

                <button
                  onClick={handleCreateTodo}
                  disabled={isCreatingTodo}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
                >
                  {isCreatingTodo ? "추가 중..." : "추가"}
                </button>
              </div>

              <textarea
                value={newTodoDescription}
                onChange={(e) => setNewTodoDescription(e.target.value)}
                placeholder="필요하면 상세 내용을 적어주세요."
                className="mt-3 min-h-20 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </div>
          )}

          {todoLoading ? (
            <p className="mt-6 text-sm text-slate-500">Todo를 불러오는 중...</p>
          ) : todos.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              아직 Todo가 없습니다. chat 페이지에서 Todo를 생성하거나 AI 생성으로 확장해주세요.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {todoGroups.map((group) => (
                <div key={group.stage}>
                  <h3 className="mb-3 text-sm font-bold text-red-600">
                    {group.label}
                  </h3>

                  <div className="space-y-3">
                    {group.items.map(({ todo }) => {
                      const isDone = isDoneTodo(todo);
                      const isEditing = editingTodoId === todo.id;

                      return (
                        <div
                          key={todo.id}
                          className="rounded-2xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/40"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isDone}
                              disabled={togglingTodoId === todo.id || isProjectCompleted}
                              onChange={() => handleToggleTodo(todo.id)}
                              className="mt-1 h-5 w-5 shrink-0 accent-red-600 disabled:cursor-not-allowed"
                            />

                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <select
                                    value={editingTodoStage}
                                    onChange={(e) => setEditingTodoStage(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                                  >
                                    {TODO_STAGES.map((stage) => (
                                      <option key={stage.value} value={stage.value}>
                                        {stage.label}
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    value={editingTodoTitle}
                                    onChange={(e) => setEditingTodoTitle(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                                  />

                                  <textarea
                                    value={editingTodoDescription}
                                    onChange={(e) =>
                                      setEditingTodoDescription(e.target.value)
                                    }
                                    className="min-h-24 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                                    placeholder="Todo 상세 내용"
                                  />

                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={cancelEditingTodo}
                                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
                                    >
                                      취소
                                    </button>

                                    <button
                                      onClick={() => handleSaveTodoEdit(todo)}
                                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                                    >
                                      저장
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p
                                      className={`text-base font-semibold ${
                                        isDone
                                          ? "text-slate-400 line-through"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {todo.title}
                                    </p>

                                    {todo.description && (
                                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                                        {todo.description}
                                      </p>
                                    )}

                                    <p className="mt-2 text-xs text-slate-400">
                                      {group.label} · {todo.status || "todo"}
                                    </p>
                                  </div>

                                  {!isProjectCompleted && (
                                    <button
                                      onClick={() => startEditingTodo(todo)}
                                      className="self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600"
                                    >
                                      수정
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {completionReviewModal}
    </main>
  );
}

function ScoreSelect({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score}점
          </option>
        ))}
      </select>
    </label>
  );
}

function groupTodosByStage(todos) {
  const groupMap = new Map(
    TODO_STAGES.map((stage) => [
      stage.value,
      { stage: stage.value, label: stage.label, items: [] },
    ])
  );
  const extraGroups = [];

  todos.forEach((todo, index) => {
    const stage = normalizeTodoStage(todo.stage);

    if (!groupMap.has(stage)) {
      const group = { stage, label: stage, items: [] };
      groupMap.set(stage, group);
      extraGroups.push(group);
    }

    groupMap.get(stage).items.push({ todo, index });
  });

  return [
    ...TODO_STAGES.map((stage) => groupMap.get(stage.value)).filter(
      (group) => group.items.length > 0
    ),
    ...extraGroups.filter((group) => group.items.length > 0),
  ];
}

function normalizeTodoStage(stage) {
  const value = String(stage || "").trim();

  if (!value || value === "planning" || value.includes("기획")) return "planning";
  if (value === "design" || value.includes("설계")) return "design";
  if (value === "development" || value.includes("개발")) return "development";
  if (value === "verification" || value.includes("검증")) return "verification";

  return value;
}
