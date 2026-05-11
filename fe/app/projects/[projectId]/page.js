"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProjectApi,
  applyProjectApi,
  requestAdoptionApi,
  getMyProfileApi,
  updateProjectApi,
  deleteProjectApi,
  revertProjectToIdeaApi,
} from "../../../lib/api";

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
];

const CATEGORY_OPTIONS = [
  "IT/소프트웨어",
  "경영/경제",
  "디자인/UI·UX",
  "AI/데이터",
  "교육/학습",
  "금융/핀테크",
  "커머스/쇼핑",
  "소셜/커뮤니티",
  "헬스케어",
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const [message, setMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const [adoptionMessage, setAdoptionMessage] = useState("");
  const [isRequestingAdoption, setIsRequestingAdoption] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    description: "",
    difficulty: "",
    category: "",
    progress_percent: 0,
    max_members: 10,
    is_public: true,
  });

  const textareaClassName =
    "mt-4 min-h-32 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  const inputClassName =
    "w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  useEffect(() => {
    async function fetchProject() {
      try {
        const [projectResult, profileResult] = await Promise.all([
          getProjectApi(projectId),
          getMyProfileApi(),
        ]);

        const projectData = projectResult.data;

        setProject(projectData);
        setMyProfile(profileResult.data);

        setEditForm({
          title: projectData.title || "",
          summary: projectData.summary || "",
          description: projectData.description || "",
          difficulty: projectData.difficulty || "",
          category: projectData.category || "",
          progress_percent: projectData.progress_percent ?? 0,
          max_members: projectData.max_members ?? projectData.recruitment_count ?? 10,
          is_public: projectData.is_public ?? true,
        });
      } catch (error) {
        console.error(error);
        alert("프로젝트 정보를 불러오지 못했습니다.");
      }
    }

    fetchProject();
  }, [projectId]);

  const isLeader = project?.leader_id === myProfile?.id;
  const acceptedMemberCount = project?.members?.length || 1;

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      alert("프로젝트 제목을 입력해주세요.");
      return;
    }

    if (!editForm.description.trim()) {
      alert("프로젝트 설명을 입력해주세요.");
      return;
    }

    if (Number(editForm.max_members) < acceptedMemberCount) {
      alert(`모집 인원은 현재 수락된 인원 ${acceptedMemberCount}명 이상이어야 합니다.`);
      return;
    }

    try {
      setIsSavingEdit(true);

      await updateProjectApi(projectId, {
        title: editForm.title,
        summary: editForm.summary,
        description: editForm.description,
        difficulty: editForm.difficulty,
        category: editForm.category,
        progress_percent: Number(editForm.progress_percent),
        max_members: Number(editForm.max_members),
        is_public: editForm.is_public,
      });

      const refreshed = await getProjectApi(projectId);
      setProject(refreshed.data);
      setIsEditing(false);

      alert("프로젝트 정보가 수정되었습니다.");
    } catch (error) {
      console.error(error);
      alert("프로젝트 수정에 실패했습니다.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRevertToIdea = async () => {
    const ok = window.confirm(
      "이 프로젝트를 영감의 샘에 흘려보낼까요?\n\n프로젝트는 삭제 처리되고, 원본 아이디어는 다른 사람들이 주울 수 있는 상태로 돌아갑니다."
    );

    if (!ok) return;

    try {
      setIsDeleting(true);
      await revertProjectToIdeaApi(projectId);

      alert("프로젝트가 영감의 샘으로 이동되었습니다.");
      router.push("/ideas/pickup");
    } catch (error) {
      console.error(error);
      alert("영감의 샘으로 보내는 데 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteProject = async () => {
    const suggestWell = window.confirm(
      "정말 삭제하시겠습니까?\n\n그냥 삭제하기보다, 다른 사람들이 이어갈 수 있도록 '영감의 샘'에 흘려보내는 건 어떨까요?\n\n확인: 영감의 샘에 흘려보내기\n취소: 삭제 계속 진행"
    );

    if (suggestWell) {
      await handleRevertToIdea();
      return;
    }

    const reallyDelete = window.confirm(
      "영감의 샘에 보내지 않고 정말 삭제하시겠습니까?"
    );

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

  const handleApply = async () => {
    if (!message.trim()) {
      alert("지원 메시지를 입력해주세요.");
      return;
    }

    try {
      setIsApplying(true);
      await applyProjectApi(projectId, message);
      alert("프로젝트 지원이 완료되었습니다.");
      setMessage("");
    } catch (error) {
      console.error(error);
      alert("프로젝트 지원에 실패했습니다.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleAdoptionRequest = async () => {
    if (!adoptionMessage.trim()) {
      alert("이어받기 요청 메시지를 입력해주세요.");
      return;
    }

    try {
      setIsRequestingAdoption(true);
      await requestAdoptionApi(projectId, adoptionMessage);
      alert("이어받기 요청이 완료되었습니다.");
      setAdoptionMessage("");
    } catch (error) {
      console.error(error);
      alert("이어받기 요청에 실패했습니다.");
    } finally {
      setIsRequestingAdoption(false);
    }
  };

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-600">프로젝트 정보를 불러오는 중...</p>
      </main>
    );
  }

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
                  프로젝트 요약
                </label>
                <input
                  className={inputClassName}
                  value={editForm.summary}
                  onChange={(e) => handleEditChange("summary", e.target.value)}
                  placeholder="프로젝트 요약"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  프로젝트 설명
                </label>
                <textarea
                  className={textareaClassName}
                  value={editForm.description}
                  onChange={(e) => handleEditChange("description", e.target.value)}
                  placeholder="프로젝트 설명"
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
                    카테고리
                  </label>
                  <select
                    className={inputClassName}
                    value={editForm.category}
                    onChange={(e) => handleEditChange("category", e.target.value)}
                  >
                    <option value="">카테고리를 선택해주세요</option>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    모집 인원
                  </label>
                  <input
                    className={inputClassName}
                    type="number"
                    min={acceptedMemberCount}
                    max="100"
                    value={editForm.max_members}
                    onChange={(e) => handleEditChange("max_members", e.target.value)}
                    placeholder="모집 인원"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    현재 수락된 인원: {acceptedMemberCount}명 이상으로만 설정할 수 있습니다.
                  </p>
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

              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm font-semibold text-slate-700">
                  <span>진행률</span>
                  <span>{project.progress_percent}%</span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-red-600"
                    style={{ width: `${project.progress_percent}%` }}
                  />
                </div>
              </div>

              {isLeader && (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                  >
                    수정하기
                  </button>

                  <button
                    onClick={handleRevertToIdea}
                    disabled={isDeleting}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    영감의 샘에 흘려보내기
                  </button>

                  <button
                    onClick={handleDeleteProject}
                    disabled={isDeleting}
                    className="rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {isDeleting ? "처리 중..." : "삭제하기"}
                  </button>
                </div>
              )}

              <button
                onClick={() => router.push(`/projects/${projectId}/chat`)}
                className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                팀 채팅방 들어가기
              </button>
            </>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">프로젝트 설명</h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-700">
              {project.description}
            </p>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">팀 정보</h2>

              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  리더 ID:{" "}
                  <span className="font-semibold text-slate-900">
                    {project.leader_id}
                  </span>
                </p>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    참여 멤버
                  </p>

                  <div className="space-y-2">
                    {(project.members || []).map((member) => (
                      <div
                        key={`${member.user_id}-${member.role_in_project}`}
                        className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/users/${member.user_id}`);
                            }}
                            className="font-semibold text-slate-900 transition hover:text-red-600 hover:underline"
                          >
                            User #{member.user_id}
                          </button>

                          <span className="text-slate-500">
                            · {member.role_in_project}
                          </span>
                        </div>
                      </div>
                    ))}
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
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    프로젝트 지원하기
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    팀장에게 보낼 간단한 소개와 참여 의지를 적어주세요.
                  </p>

                  <textarea
                    className={textareaClassName}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="예: React와 UI 구현을 맡아 참여하고 싶습니다."
                  />

                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isApplying ? "지원 중..." : "지원하기"}
                  </button>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    프로젝트 이어받기
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    이 프로젝트를 이어서 진행하고 싶은 이유를 작성해주세요.
                  </p>

                  <textarea
                    className={textareaClassName}
                    value={adoptionMessage}
                    onChange={(e) => setAdoptionMessage(e.target.value)}
                    placeholder="예: 기존 아이디어를 발전시켜 완성도 높은 서비스로 이어가고 싶습니다."
                  />

                  <button
                    onClick={handleAdoptionRequest}
                    disabled={isRequestingAdoption}
                    className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isRequestingAdoption ? "요청 중..." : "이어받기 요청하기"}
                  </button>
                </section>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}