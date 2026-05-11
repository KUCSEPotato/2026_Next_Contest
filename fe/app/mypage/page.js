"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStoredUser } from "../../lib/auth";
import {
  getMyProfileApi,
  getMyReputationApi,
  getUserStatsApi,
  getMyProjectsApi,
  getMyReceivedReviewsApi,
  updateMyProfileApi,
  addMySkillApi,
  addMyInterestApi,
  discardProjectToWellApi,
  getProjectApi,
  createProjectReviewApi,
  uploadMyAvatarApi,
  getImageUrl,
} from "../../lib/api";

export default function MyPage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [discardingId, setDiscardingId] = useState(null);
  const [discardConfirm, setDiscardConfirm] = useState(null);

  const [reviewProject, setReviewProject] = useState(null);
  const [reviewTargets, setReviewTargets] = useState([]);
  const [reviewInputs, setReviewInputs] = useState({});
  const [isSubmittingReviews, setIsSubmittingReviews] = useState(false);

  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      setIsUploadingAvatar(true);

      const result = await uploadMyAvatarApi(file);
      const avatarUrl = result.data.avatar_url;
      console.log("업로드 결과:", result);
      console.log("avatarUrl:", avatarUrl);


      setProfile((prev) => ({
        ...prev,
        avatar_url: avatarUrl,
      }));

      setEditAvatarUrl(avatarUrl);

      alert("프로필 이미지가 업로드되었습니다.");
    } catch (error) {
      console.error(error);
      alert("프로필 이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const inputClassName =
    "w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  async function reloadProfile() {
    const profileResult = await getMyProfileApi();
    const profileData = profileResult.data;

    setProfile(profileData);
    setEditNickname(profileData.nickname || "");
    setEditBio(profileData.bio || "");
    setEditAvatarUrl(profileData.avatar_url || "");
  }

  async function reloadMyProjects() {
    const projectsResult = await getMyProjectsApi();
    setProjects(projectsResult.data || []);
  }

  useEffect(() => {
    async function loadMyPage() {
      try {
        setLoading(true);

        const profileResult = await getMyProfileApi();
        const profileData = profileResult.data;

        setProfile(profileData);
        setEditNickname(profileData.nickname || "");
        setEditBio(profileData.bio || "");
        setEditAvatarUrl(profileData.avatar_url || "");

        const [reputationResult, statsResult, projectsResult, reviewsResult] =
          await Promise.allSettled([
            getMyReputationApi(),
            getUserStatsApi(profileData.id),
            getMyProjectsApi(),
            getMyReceivedReviewsApi(),
          ]);

        setReputation(
          reputationResult.status === "fulfilled"
            ? reputationResult.value.data
            : null
        );

        setStats(
          statsResult.status === "fulfilled"
            ? statsResult.value.data
            : {
                lead_projects: 0,
                completed_projects: 0,
                review_received: 0,
              }
        );

        setProjects(
          projectsResult.status === "fulfilled"
            ? projectsResult.value.data || []
            : []
        );

        setReviews(
          reviewsResult.status === "fulfilled"
            ? reviewsResult.value.data || []
            : []
        );
      } catch (error) {
        console.error("프로필 조회 실패:", error);
        alert("프로필 정보를 불러오지 못했습니다. 다시 로그인해주세요.");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    loadMyPage();
  }, [router]);

  const isTeamFormedProject = (project) => {
    return ["in_progress", "started", "completed", "paused"].includes(
      project?.status
    );
  };

  const openDiscardFlow = async (project) => {
    if (!project.can_discard) return;

    if (!isTeamFormedProject(project)) {
      setDiscardConfirm(project);
      return;
    }

    try {
      const result = await getProjectApi(project.id);
      const detail = result.data;

      const targets = (detail.members || []).filter(
        (member) => member.user_id !== profile?.id
      );

      if (targets.length === 0) {
        setDiscardConfirm(project);
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

      setReviewProject(project);
      setReviewTargets(targets);
      setReviewInputs(initialInputs);
    } catch (error) {
      console.error(error);
      alert("프로젝트 멤버 정보를 불러오지 못했습니다.");
    }
  };

  const updateReviewInput = (userId, field, value) => {
    setReviewInputs((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const discardProject = async (project) => {
    try {
      setDiscardingId(project.id);
      await discardProjectToWellApi(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setDiscardConfirm(null);
      alert(`"${project.title}" 프로젝트가 영감의 샘으로 이동되었습니다.`);
    } catch (error) {
      console.error(error);
      alert("프로젝트 버리기에 실패했습니다.");
    } finally {
      setDiscardingId(null);
    }
  };

  const submitReviewsAndDiscard = async () => {
    if (!reviewProject) return;

    try {
      setIsSubmittingReviews(true);

      for (const target of reviewTargets) {
        const input = reviewInputs[target.user_id];

        await createProjectReviewApi(reviewProject.id, {
          reviewee_id: target.user_id,
          teamwork_score: Number(input.teamwork_score),
          contribution_score: Number(input.contribution_score),
          responsibility_score: Number(input.responsibility_score),
          comment: input.comment,
        });
      }

      await discardProjectToWellApi(reviewProject.id);

      setProjects((prev) => prev.filter((p) => p.id !== reviewProject.id));
      setReviewProject(null);
      setReviewTargets([]);
      setReviewInputs({});

      await reloadProfile();

      alert("팀원 평가가 저장되었고, 프로젝트가 영감의 샘으로 이동되었습니다.");
    } catch (error) {
      console.error(error);
      alert("평가 저장 또는 프로젝트 버리기에 실패했습니다.");
    } finally {
      setIsSubmittingReviews(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const result = await updateMyProfileApi({
        nickname: editNickname,
        bio: editBio,
      });

      alert("프로필이 수정되었습니다.");

      setProfile((prev) => ({
        ...prev,
        ...result.data,
        email: prev?.email,
        skills: prev?.skills,
        interests: prev?.interests,
      }));
      updateStoredUser(result.data);
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error);
      alert("프로필 수정에 실패했습니다.");
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim()) {
      alert("기술 스택을 입력해주세요.");
      return;
    }

    try {
      await addMySkillApi(newSkill);
      setNewSkill("");
      await reloadProfile();
      alert("기술 스택이 추가되었습니다.");
    } catch (error) {
      console.error(error);
      alert("기술 스택 추가에 실패했습니다.");
    }
  };

  const handleAddInterest = async () => {
    if (!newInterest.trim()) {
      alert("관심 분야를 입력해주세요.");
      return;
    }

    try {
      await addMyInterestApi(newInterest);
      setNewInterest("");
      await reloadProfile();
      alert("관심 분야가 추가되었습니다.");
    } catch (error) {
      console.error(error);
      alert("관심 분야 추가에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">마이페이지를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-red-100 text-3xl font-bold text-red-600">
              {profile?.avatar_url ? (
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-red-100 text-3xl font-bold text-red-600">
                  {profile?.avatar_url ? (
                    <img
                      src={getImageUrl(profile.avatar_url)}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    profile?.nickname?.[0] || "D"
                  )}
                </div>
              ) : (
                profile?.nickname?.[0] || "D"
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {profile?.nickname || "이름 없는 사용자"}
              </h1>
              <p className="text-slate-500">{profile?.email}</p>
              <p className="mt-2 text-slate-700">
                {profile?.bio || "아직 자기소개가 없습니다."}
              </p>
            </div>
            </div>

            <button
              onClick={() => setIsEditingProfile(true)}
              className="shrink-0 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              수정하기
            </button>
          </div>
        </section>

        {isEditingProfile && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditNickname(profile?.nickname || "");
                setEditBio(profile?.bio || "");
                setEditAvatarUrl(profile?.avatar_url || "");
                setIsEditingProfile(false);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
          <h2 className="text-xl font-bold text-slate-900">프로필 수정</h2>

          <div className="mt-4 space-y-4">
            <input
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder="닉네임"
              className={inputClassName}
            />

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                프로필 이미지
              </p>

              <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3">
                <label className="cursor-pointer rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
                  파일 선택
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="hidden"
                  />
                </label>

                <span className="text-sm text-slate-500">
                  {profile?.avatar_url
                    ? "변경하시려면 파일을 선택하십시오."
                    : "선택된 파일 없음"}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                {isUploadingAvatar
                  ? "이미지를 업로드하는 중입니다..."
                  : "이미지 파일을 선택하면 자동으로 업로드됩니다."}
              </p>
            </div>

            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="자기소개"
              className="min-h-32 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />

            <button
              onClick={handleUpdateProfile}
              className="w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              프로필 저장
            </button>
          </div>
        </section>
        )}

        <section className="mb-6 grid grid-cols-3 gap-4">
          <StatCard title="리드 프로젝트" value={stats?.lead_projects ?? 0} />
          <StatCard title="완료 프로젝트" value={stats?.completed_projects ?? 0} />

          <button
            onClick={() => setShowReviews(!showReviews)}
            className="rounded-2xl bg-white p-6 text-left shadow transition hover:bg-red-50"
          >
            <p className="text-sm text-slate-500">받은 리뷰</p>
            <p className="text-3xl font-bold">{stats?.review_received ?? 0}</p>
          </button>
        </section>

        {showReviews && (
          <section className="mb-6 rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">받은 리뷰</h2>

            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">리뷰 없음</p>
            ) : (
              reviews.map((review) => {
                const reviewMessage = getReviewMessage(review);

                return (
                  <div
                    key={review.id}
                    className="mb-3 rounded-xl border border-slate-200 p-4"
                  >
                    <p className="font-bold text-slate-900">
                      {review.project?.title || "프로젝트"}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      익명{" "}
                      {review.created_at
                        ? `• ${new Date(review.created_at).toLocaleDateString()}`
                        : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        협업 {review.teamwork_score}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        기여 {review.contribution_score}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        책임 {review.responsibility_score}
                      </span>
                    </div>

                    <p
                      className={`mt-3 rounded-xl px-4 py-3 text-sm leading-6 ${
                        reviewMessage
                          ? "bg-red-50 text-slate-700"
                          : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      {reviewMessage || "작성된 리뷰 메시지가 없습니다."}
                    </p>
                  </div>
                );
              })
            )}
          </section>
        )}

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">신뢰도</h2>
              <p className="mt-1 text-sm text-slate-500">
                내 평점과 전체 이용자 평균을 함께 비교합니다.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
              받은 평가 {reputation?.review_count ?? 0}개 · 전체{" "}
              {reputation?.global_review_count ?? 0}개
            </div>
          </div>

          <RatingComparison reputation={reputation} />
        </section>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">기술 스택</h2>

            <div className="mt-4 flex gap-3">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="예: React"
                className={inputClassName}
              />

              <button
                onClick={handleAddSkill}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                추가
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile?.skills?.length ? (
                profile.skills.map((skill) => (
                  <span
                    key={typeof skill === "string" ? skill : skill.id || skill.name}
                    className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700"
                  >
                    {typeof skill === "string" ? skill : skill.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  등록된 기술 스택이 없습니다.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">관심 분야</h2>

            <div className="mt-4 flex gap-3">
              <input
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                placeholder="예: AI"
                className={inputClassName}
              />

              <button
                onClick={handleAddInterest}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                추가
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile?.interests?.length ? (
                profile.interests.map((interest) => (
                  <span
                    key={
                      typeof interest === "string"
                        ? interest
                        : interest.id || interest.name
                    }
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {typeof interest === "string" ? interest : interest.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  등록된 관심 분야가 없습니다.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">프로젝트 이력</h2>

          <div className="space-y-3">
            {projects.length ? (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-red-300 hover:bg-red-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {project.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        난이도 {project.difficulty || "미정"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                        {project.status || "상태 없음"}
                      </span>

                      {project.can_discard && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openDiscardFlow(project);
                          }}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
                        >
                          프로젝트 버리기
                        </span>
                      )}

                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}/manage`);
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        진행 관리
                      </span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">프로젝트 없음</p>
            )}
          </div>
        </section>
      </div>

      {discardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setDiscardConfirm(null)}
          />

          <div className="relative w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
            <h2 className="mb-2 text-center text-base font-bold text-slate-800">
              프로젝트를 영감의 샘으로 이동할까요?
            </h2>

            <p className="mb-1 text-center text-sm font-semibold text-slate-700 line-clamp-1">
              &quot;{discardConfirm.title}&quot;
            </p>

            <p className="mb-6 text-center text-sm text-slate-400 leading-relaxed">
              이 프로젝트는 프로젝트 목록에서 사라지고,
              <br />
              영감의 샘에 아이디어로 표시됩니다.
              <br />
              이 작업은 되돌릴 수 없습니다.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDiscardConfirm(null)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
              >
                취소
              </button>

              <button
                onClick={() => discardProject(discardConfirm)}
                disabled={discardingId === discardConfirm.id}
                className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {discardingId === discardConfirm.id ? "처리 중..." : "이동하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!isSubmittingReviews) {
                setReviewProject(null);
                setReviewTargets([]);
                setReviewInputs({});
              }
            }}
          />

          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">
              팀원 평가 후 프로젝트 버리기
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              진행중인 프로젝트를 버리기 전에 함께한 팀원들을 평가해주세요.
              평가는 각 사용자의 마이페이지 신뢰도에 반영됩니다.
            </p>

            <div className="mt-6 space-y-5">
              {reviewTargets.map((member) => {
                const input = reviewInputs[member.user_id] || {
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
                      User #{member.user_id} · {member.role_in_project}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <ScoreSelect
                        label="협업"
                        value={input.teamwork_score}
                        onChange={(value) =>
                          updateReviewInput(
                            member.user_id,
                            "teamwork_score",
                            value
                          )
                        }
                      />

                      <ScoreSelect
                        label="기여"
                        value={input.contribution_score}
                        onChange={(value) =>
                          updateReviewInput(
                            member.user_id,
                            "contribution_score",
                            value
                          )
                        }
                      />

                      <ScoreSelect
                        label="책임"
                        value={input.responsibility_score}
                        onChange={(value) =>
                          updateReviewInput(
                            member.user_id,
                            "responsibility_score",
                            value
                          )
                        }
                      />
                    </div>

                    <textarea
                      value={input.comment}
                      onChange={(e) =>
                        updateReviewInput(
                          member.user_id,
                          "comment",
                          e.target.value
                        )
                      }
                      placeholder="간단한 평가 코멘트를 남겨주세요."
                      className="mt-4 min-h-24 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setReviewProject(null);
                  setReviewTargets([]);
                  setReviewInputs({});
                }}
                disabled={isSubmittingReviews}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>

              <button
                onClick={submitReviewsAndDiscard}
                disabled={isSubmittingReviews}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmittingReviews ? "처리 중..." : "평가 저장 후 버리기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function RatingComparison({ reputation }) {
  const items = [
    {
      label: "종합",
      mine: reputation?.score,
      global: reputation?.global_score,
    },
    {
      label: "협업",
      mine: reputation?.avg_teamwork,
      global: reputation?.global_avg_teamwork,
    },
    {
      label: "기여",
      mine: reputation?.avg_contribution,
      global: reputation?.global_avg_contribution,
    },
    {
      label: "책임",
      mine: reputation?.avg_responsibility,
      global: reputation?.global_avg_responsibility,
    },
  ];

  return (
    <div className="mt-5 space-y-4">
      {items.map((item) => (
        <RatingRow
          key={item.label}
          label={item.label}
          mine={item.mine}
          global={item.global}
        />
      ))}
    </div>
  );
}

function RatingRow({ label, mine, global }) {
  const mineValue = normalizeRating(mine);
  const globalValue = normalizeRating(global);

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-bold text-slate-900">{label}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-red-600">
            나 {formatRating(mineValue)}
          </span>
          <span className="text-slate-400">
            전체 {formatRating(globalValue)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <RatingBar label="나" value={mineValue} className="bg-red-600" />
        <RatingBar label="전체 평균" value={globalValue} className="bg-slate-400" />
      </div>
    </div>
  );
}

function RatingBar({ label, value, className }) {
  return (
    <div className="grid grid-cols-[70px_1fr] items-center gap-3 text-xs font-semibold text-slate-500">
      <span>{label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${className}`}
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

function normalizeRating(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(5, Math.max(0, numericValue));
}

function formatRating(value) {
  return normalizeRating(value).toFixed(1);
}

function getReviewMessage(review) {
  const message =
    review?.comment ||
    review?.message ||
    review?.review_message ||
    review?.content ||
    "";

  return String(message).trim();
}

function ScoreSelect({ label, value, onChange }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
      >
        <option value={1}>1점</option>
        <option value={2}>2점</option>
        <option value={3}>3점</option>
        <option value={4}>4점</option>
        <option value={5}>5점</option>
      </select>
    </label>
  );
}
