"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "../../../../lib/api";

const unwrapResponseData = (result, fallback = null) =>
  result?.data?.data ?? result?.data ?? fallback;

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [projectResult, profileResult, applicationsResult, todosResult] =
          await Promise.all([
            getProjectApi(projectId),
            getMyProfileApi(),
            getProjectApplicationsApi(projectId),
            getTodosApi(projectId),
          ]);

        setProject(projectResult.data);
        setProfile(profileResult.data);
        setApplications(applicationsResult.data || []);
        setTodos(Array.isArray(todosResult.data) ? todosResult.data : []);
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

  const acceptedCount = applications.filter(
    (application) => application.status === "accepted"
  ).length;

  const maxMembers = project?.maxMembers ?? project?.max_members ?? 0;
  const currentMemberCount =
    project?.currentMembers ?? project?.current_members ?? project?.members?.length ?? 1;
  const displayCurrentMemberCount = Math.max(currentMemberCount, acceptedCount + 1);
  const isTeamFull = maxMembers > 0 && displayCurrentMemberCount >= maxMembers;
  const canAcceptMore = !maxMembers || displayCurrentMemberCount < maxMembers;
  const doneTodoCount = todos.filter((todo) => todo.status === "done").length;
  const todoCompletionRate = todos.length
    ? Math.round((doneTodoCount / todos.length) * 100)
    : 0;
  const canCompleteProject =
    project?.status === "in_progress" && todos.length > 0 && todoCompletionRate >= 70;
  const isProjectCompleted = project?.status === "completed";

  const reloadProjectAndTodos = async () => {
    const [proj, todoResult] = await Promise.all([
      getProjectApi(projectId),
      getTodosApi(projectId),
    ]);

    setProject(unwrapResponseData(proj));
    setTodos(Array.isArray(todoResult.data) ? todoResult.data : []);
  };

  const handleDecision = async (applicationId, status) => {
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
  };

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditingTodoTitle("");
    setEditingTodoDescription("");
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

  const handleCompleteProject = async () => {
    if (!canCompleteProject) return;

    if (!confirm("프로젝트를 완료 처리할까요? 완료 후 회고록을 작성할 수 있습니다.")) {
      return;
    }

    try {
      setIsCompletingTeam(true);
      await updateProjectStatusApi(projectId, "completed");
      await reloadProjectAndTodos();
      alert("프로젝트가 완료되었습니다.");
    } catch (error) {
      console.error(error);
      alert("프로젝트 완료 처리에 실패했습니다.");
    } finally {
      setIsCompletingTeam(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">프로젝트 관리 정보를 불러오는 중...</p>
      </main>
    );
  }

  if (!isLeader) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">접근 권한이 없습니다.</h1>
          <p className="mt-3 text-slate-500">
            프로젝트 등록인만 지원자 목록을 확인하고 팀을 확정할 수 있습니다.
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
            {project?.title || "프로젝트"} 지원자 관리
          </h1>

          <p className="mt-3 text-slate-500">
            지원자의 프로필과 지원 메시지를 확인하고 팀원을 확정하세요.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            확정 인원: {displayCurrentMemberCount} /{" "}
            {maxMembers ? `${maxMembers}명 (리더 포함)` : "제한 없음"}
          </div>

          {(isTeamFull || project?.status === "in_progress") && !isProjectCompleted && (
            <button
              onClick={handleCompleteTeam}
              disabled={isCompletingTeam || project?.status === "in_progress"}
              className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {project?.status === "in_progress"
                ? "이미 팀 결성이 완료되었습니다"
                : isCompletingTeam
                ? "팀 결성 중..."
                : "팀 결성하기"}
            </button>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Todo 진행률 {todoCompletionRate}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {doneTodoCount} / {todos.length}개 완료
                </p>
              </div>

              {canCompleteProject && (
                <button
                  onClick={handleCompleteProject}
                  disabled={isCompletingTeam}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
                >
                  {isCompletingTeam ? "완료 처리 중..." : "complete"}
                </button>
              )}

              {isProjectCompleted && (
                <button
                  onClick={() => router.push(`/memoir?projectId=${projectId}`)}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  텃밭일기
                </button>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-red-600 transition-all"
                style={{ width: `${todoCompletionRate}%` }}
              />
            </div>

            {project?.status === "in_progress" && todos.length > 0 && todoCompletionRate < 70 && (
              <p className="mt-2 text-xs text-slate-500">
                Todo를 70% 이상 완료하면 팀장에게 complete 버튼이 표시됩니다.
              </p>
            )}
          </div>
        </section>

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
                        <p className="text-lg font-bold text-slate-900">
                          {applicant?.nickname ||
                            applicant?.name ||
                            `User #${application.applicant_id}`}
                        </p>

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

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Team Todo</h2>
              <p className="mt-2 text-sm text-slate-500">
                chat 페이지에서 만든 Todo를 관리하고 완료 여부를 체크합니다.
              </p>
            </div>

            <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
              {todoCompletionRate}% 완료
            </div>
          </div>

          {todoLoading ? (
            <p className="mt-6 text-sm text-slate-500">Todo를 불러오는 중...</p>
          ) : todos.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              아직 Todo가 없습니다. chat 페이지에서 Todo를 생성하거나 AI 생성으로 확장해주세요.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {todos.map((todo) => {
                const isDone = todo.status === "done";
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
                                {todo.stage || "planning"} · {todo.status || "todo"}
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
          )}
        </section>
      </div>
    </main>
  );
}
