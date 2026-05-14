"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressBloom from "../../components/ProgressBloom";
import { removeToken, updateStoredUser } from "../../lib/auth";
import { useDialog, useToast } from "../../components/AppFeedback";
import { INTERESTS_LIST, SKILLS_LIST } from "../../lib/profileOptions";
import {
  getMyProfileApi,
  getMyReputationApi,
  getUserStatsApi,
  getUserReceivedReviewsApi,
  getMyProjectsApi,
  getMyApplicationsApi,
  getMyReceivedReviewsApi,
  getOAuthLinksApi,
  updateMyProfileApi,
  withdrawMyAccountApi,
  addMySkillApi,
  addMyInterestApi,
  removeMySkillApi,
  removeMyInterestApi,
  uploadMyAvatarApi,
  getImageUrl,
  getChatRoomsApi,
  createChatRoomApi,
  getMyEntitlementApi,
  getMyCoinBalanceApi,
} from "../../lib/api";

function formatEntitlementDate(value) {
  if (!value) return "제한 없음";

  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatWaterdrops(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}방울`;
}

export default function MyPage() {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialog();
  const projectHistoryRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [appliedProjects, setAppliedProjects] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [oauthLinks, setOauthLinks] = useState(null);
  const [entitlement, setEntitlement] = useState(null);
  const [waterdropBalance, setWaterdropBalance] = useState(0);
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [projectRoleFilter, setProjectRoleFilter] = useState("all");
  const [projectSortOrder, setProjectSortOrder] = useState("latest");

  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [isStartingGithubLink, setIsStartingGithubLink] = useState(false);
  const [openingChatProjectId, setOpeningChatProjectId] = useState(null);

  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
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

      setAvatarLoadFailed(false);

      setProfile((prev) => ({
        ...prev,
        avatar_url: avatarUrl,
      }));

      await reloadProfile();

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
    setAvatarLoadFailed(false);
    setEditNickname(profileData.nickname || "");
    setEditBio(profileData.bio || "");

    return profileData;
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

        const [
          reputationResult,
          statsResult,
          projectsResult,
          applicationsResult,
          oauthLinksResult,
          entitlementResult,
          balanceResult,
        ] =
          await Promise.allSettled([
            getMyReputationApi(),
            getUserStatsApi(profileData.id),
            getMyProjectsApi(),
            getMyApplicationsApi(),
            getOAuthLinksApi(),
            getMyEntitlementApi(),
            getMyCoinBalanceApi(),
          ]);

        setReputation(
          reputationResult.status === "fulfilled"
            ? reputationResult.value.data
            : null
        );

        const statsData =
          statsResult.status === "fulfilled"
            ? statsResult.value.data
            : {
                lead_projects: 0,
                completed_projects: 0,
                in_progress_projects: 0,
                review_received: 0,
              };

        setStats(statsData);

        setProjects(
          projectsResult.status === "fulfilled"
            ? projectsResult.value.data || []
            : []
        );
        setAppliedProjects(
          applicationsResult.status === "fulfilled"
            ? applicationsResult.value.data || []
            : []
        );
        setOauthLinks(
          oauthLinksResult.status === "fulfilled"
            ? oauthLinksResult.value.data
            : null
        );
        setEntitlement(
          entitlementResult.status === "fulfilled"
            ? entitlementResult.value.data
            : null
        );
        setWaterdropBalance(
          balanceResult.status === "fulfilled"
            ? balanceResult.value.data?.waterdrop_balance ?? balanceResult.value.data?.coin_balance ?? 0
            : 0
        );

        const reviewsData = await loadReceivedReviews(profileData.id, statsData);
        setReviews(reviewsData);
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

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("github_linked") !== "1") return;

    toast.success("GitHub 계정이 연동되었습니다.");
    router.replace("/mypage", { scroll: false });
  }, [loading, router, toast]);

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("section") !== "projects") return;

    requestAnimationFrame(() => {
      projectHistoryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [loading]);

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
      const message = error?.message || "";
      if (
        message.includes("이미 존재하는 닉네임입니다") ||
        message.includes("Nickname already exists")
      ) {
        alert("이미 존재하는 닉네임입니다.");
        return;
      }
      alert("프로필 수정에 실패했습니다.");
    }
  };

  const handleWithdrawAccount = async () => {
    const confirmed = await confirm({
      title: "회원 탈퇴",
      message: "회원 탈퇴 후 계정은 복구할 수 없습니다. 정말 탈퇴하시겠습니까?",
      confirmText: "탈퇴하기",
      cancelText: "취소",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      setIsWithdrawing(true);
      await withdrawMyAccountApi();
      removeToken({ reason: "withdrawn" });
      toast.success("회원 탈퇴가 완료되었습니다.");
      router.replace("/login");
    } catch (error) {
      console.error(error);
      toast.error("회원 탈퇴에 실패했습니다.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleStartGithubLink = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri =
      process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI ||
      `${window.location.origin}/auth/github/callback`;

    if (!clientId) {
      toast.error("GitHub OAuth 환경변수가 설정되지 않았습니다.");
      return;
    }

    setIsStartingGithubLink(true);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state: "link_github",
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  const handleAddSkill = async (skillName) => {
    if (!skillName.trim()) {
      alert("기술 스택을 입력해주세요.");
      return;
    }

    try {
      await addMySkillApi(skillName);
      await reloadProfile();
      alert("기술 스택이 추가되었습니다.");
    } catch (error) {
      console.error(error);
      const refreshedProfile = await reloadProfile().catch(() => null);
      if (hasProfileOption(refreshedProfile?.skills, skillName)) {
        alert("이미 등록된 기술 스택입니다.");
        return;
      }
      alert("기술 스택 추가에 실패했습니다.");
    }
  };

  const handleToggleSkill = async (skillName) => {
    const selectedOption = findProfileOption(profile?.skills, skillName);

    if (!selectedOption) {
      await handleAddSkill(skillName);
      return;
    }

    const skillId = getProfileOptionId(selectedOption);
    if (!skillId) {
      alert("이 기술 스택은 새로고침 후 삭제할 수 있습니다.");
      await reloadProfile();
      return;
    }

    try {
      await removeMySkillApi(skillId);
      await reloadProfile();
      alert("기술 스택이 삭제되었습니다.");
    } catch (error) {
      console.error(error);
      alert("기술 스택 삭제에 실패했습니다.");
    }
  };

  const handleAddInterest = async (interestName) => {
    if (!interestName.trim()) {
      alert("관심 분야를 입력해주세요.");
      return;
    }

    try {
      await addMyInterestApi(interestName);
      await reloadProfile();
      alert("관심 분야가 추가되었습니다.");
    } catch (error) {
      console.error(error);
      const refreshedProfile = await reloadProfile().catch(() => null);
      if (hasProfileOption(refreshedProfile?.interests, interestName)) {
        alert("이미 등록된 관심 분야입니다.");
        return;
      }
      alert("관심 분야 추가에 실패했습니다.");
    }
  };

  const handleToggleInterest = async (interestName) => {
    const selectedOption = findProfileOption(profile?.interests, interestName);

    if (!selectedOption) {
      await handleAddInterest(interestName);
      return;
    }

    const interestId = getProfileOptionId(selectedOption);
    if (!interestId) {
      alert("이 관심 분야는 새로고침 후 삭제할 수 있습니다.");
      await reloadProfile();
      return;
    }

    try {
      await removeMyInterestApi(interestId);
      await reloadProfile();
      alert("관심 분야가 삭제되었습니다.");
    } catch (error) {
      console.error(error);
      alert("관심 분야 삭제에 실패했습니다.");
    }
  };

  const openTeamChat = async (project) => {
    if (!project.can_chat) {
      alert("팀에 속한 프로젝트만 채팅방으로 이동할 수 있습니다.");
      return;
    }

    try {
      setOpeningChatProjectId(project.id);

      const roomsResult = await getChatRoomsApi(project.id);
      const rooms = Array.isArray(roomsResult.data) ? roomsResult.data : [];
      const activeRoom = rooms.find((room) => room.is_active) || rooms[0];

      if (activeRoom) {
        router.push(`/chat/${activeRoom.id}?projectId=${project.id}`);
        return;
      }

      const created = await createChatRoomApi(project.id, {
        name: project.title || `Project #${project.id}`,
      });
      router.push(`/chat/${created.data.id}?projectId=${project.id}`);
    } catch (error) {
      console.error(error);
      alert("팀 채팅방으로 이동하지 못했습니다.");
    } finally {
      setOpeningChatProjectId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">마이페이지를 불러오는 중...</p>
      </main>
    );
  }

  const projectHistory = buildProjectHistory(projects, appliedProjects);
  const visibleProjects = getVisibleProjects(
    projectHistory,
    projectStatusFilter,
    projectRoleFilter,
    profile?.id,
    projectSortOrder
  );
  const rawAvatarUrl = profile?.avatar_url || profile?.avatarUrl || "";
  const avatarUrl =
    rawAvatarUrl && !avatarLoadFailed
      ? getImageUrl(rawAvatarUrl)
      : "";
  const avatarFallback = profile?.nickname?.[0] || "D";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-900">
                  {profile?.nickname || "이름 없는 사용자"}
                </h1>
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-red-100 text-2xl font-bold text-red-600">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${profile?.nickname || "사용자"} 프로필 이미지`}
                      className="h-full w-full object-cover"
                      onError={() => {
                        console.error("프로필 이미지 로드 실패:", avatarUrl);
                        setAvatarLoadFailed(true);
                      }}
                    />
                  ) : (
                    avatarFallback
                  )}
                </div>
              </div>
              <p className="text-slate-500">{profile?.email}</p>
              <p className="mt-2 text-slate-700">
                {profile?.bio || "아직 자기소개가 없습니다."}
              </p>
              <ProfileOptionPreview
                title="기술 스택"
                items={profile?.skills}
                tone="red"
              />
              <ProfileOptionPreview
                title="관심 분야"
                items={profile?.interests}
                tone="slate"
              />
              {entitlement && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-red-700">
                      현재 플랜: {entitlement.name || entitlement.plan || "무료"}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-sky-700">
                      현재 잔액: {formatWaterdrops(waterdropBalance)}
                    </span>
                    {entitlement.product_type !== "FREE" && (
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-red-600">
                        {entitlement.product_type === "SUBSCRIPTION" ? "30일 이용권" : "기간권"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    남은 기간:{" "}
                    {entitlement.days_remaining === null || entitlement.days_remaining === undefined
                      ? "제한 없음"
                      : `${entitlement.days_remaining}일`}
                    {" · "}
                    만료일: {formatEntitlementDate(entitlement.expires_at)}
                  </p>
                  {entitlement.product_type === "SUBSCRIPTION" && (
                    <p className="mt-1 text-xs text-slate-500">
                      다음 갱신일: {formatEntitlementDate(entitlement.next_renewal_at)}
                      {" · "}
                      자동 갱신:{" "}
                      {entitlement.auto_renew_enabled
                        ? "사용 중"
                        : entitlement.renewal_status === "PENDING_BILLING_SETUP"
                          ? "결제수단 등록 필요"
                          : "꺼짐"}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-600">
                    프로젝트 생성:{" "}
                    {entitlement.benefits?.project_create_daily_limit
                      ? `일 ${entitlement.benefits.project_create_daily_limit}회`
                      : entitlement.benefits?.project_create_total_limit
                        ? `총 ${entitlement.benefits.project_create_total_limit}회`
                        : "불가"}
                    {" · "}
                    지원:{" "}
                    {entitlement.benefits?.project_apply_unlimited
                      ? "무제한"
                      : entitlement.benefits?.project_apply_daily_limit
                        ? `일 ${entitlement.benefits.project_apply_daily_limit}회`
                        : entitlement.benefits?.project_apply_total_limit
                          ? `총 ${entitlement.benefits.project_apply_total_limit}회`
                          : "일 1회"}
                    {entitlement.benefits?.project_boost_remaining
                      ? ` · 상단 노출 ${entitlement.benefits.project_boost_remaining}회 남음`
                      : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
              {oauthLinks?.github_linked ? (
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  <GithubIcon />
                  GitHub 연동됨
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleStartGithubLink}
                  disabled={isStartingGithubLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GithubIcon />
                  {isStartingGithubLink ? "연동 중..." : "GitHub 연동"}
                </button>
              )}
              <button
                onClick={() => setIsEditingProfile(true)}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={handleWithdrawAccount}
                disabled={isWithdrawing}
                className="rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWithdrawing ? "처리 중..." : "회원 탈퇴"}
              </button>
            </div>
          </div>
        </section>

        {isEditingProfile && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditNickname(profile?.nickname || "");
                setEditBio(profile?.bio || "");
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

            <div className="grid gap-5 lg:grid-cols-2">
              <ProfileOptionEditor
                title="기술 스택"
                options={SKILLS_LIST}
                selectedItems={profile?.skills}
                selectedClassName="border-red-600 bg-red-600 text-white shadow-sm"
                onToggle={handleToggleSkill}
              />
              <ProfileOptionEditor
                title="관심 분야"
                options={INTERESTS_LIST}
                selectedItems={profile?.interests}
                selectedClassName="border-red-600 bg-red-50 text-red-600 shadow-sm"
                onToggle={handleToggleInterest}
              />
            </div>

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
          <StatCard title="진행중인 프로젝트" value={stats?.in_progress_projects ?? 0} />
        </section>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">신뢰도</h2>
              <p className="mt-1 text-sm text-slate-500">
                받은 리뷰를 바탕으로 평점 항목을 확인합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowReviews(!showReviews)}
              className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
            >
              받은 리뷰 {stats?.review_received ?? reputation?.review_count ?? 0}개
            </button>
          </div>

          <RatingSummary reputation={reputation} />

          {showReviews && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="mb-4 text-base font-bold text-slate-900">받은 리뷰</h3>

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
            </div>
          )}
        </section>

        <section
          ref={projectHistoryRef}
          id="my-projects"
          className="scroll-mt-24 rounded-2xl bg-white p-6 shadow"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold">프로젝트 이력</h2>

            <div className="flex flex-wrap gap-2">
              <select
                value={projectStatusFilter}
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition focus:border-red-500"
              >
                <option value="all">전체</option>
                <option value="planning">planning</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
              </select>

              <select
                value={projectRoleFilter}
                onChange={(e) => setProjectRoleFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition focus:border-red-500"
              >
                <option value="all">전체 역할</option>
                <option value="leader">내가 리더</option>
                <option value="member">팀원으로 참여</option>
              </select>

              <select
                value={projectSortOrder}
                onChange={(e) => setProjectSortOrder(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition focus:border-red-500"
              >
                <option value="latest">최신순</option>
                <option value="progress">진행율순</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {visibleProjects.length ? (
              visibleProjects.map((project) => {
                const isLeader = isProjectLeader(project, profile?.id);
                const isApplied = project.historyType === "applied";
                const statusClassName = getProjectStatusClassName(project.status);

                return (
                  <article
                    key={project.historyKey || project.id}
                    className={`rounded-xl border px-5 py-4 transition hover:border-red-300 ${
                      isApplied
                        ? "border-red-200 bg-red-50/70"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <button
                        type="button"
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="flex flex-1 items-center gap-4 text-left"
                      >
                        <ProgressBloom
                          progress={project.progress_percent ?? 0}
                          size="sm"
                          showLabel={false}
                        />
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap gap-1.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isLeader
                                ? "bg-red-600 text-white"
                                : isApplied
                                  ? "bg-red-100 text-red-600"
                                  : "bg-slate-200 text-slate-600"
                            }`}>
                              {isLeader ? "리더" : isApplied ? "지원 대기" : "팀원"}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              {project.title}
                            </h3>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClassName}`}>
                              {formatProjectStatus(project.status)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            난이도 {project.difficulty || "미정"} · 진행률 {Math.round(project.progress_percent ?? 0)}%
                            {isApplied && ` · 지원 상태 ${project.applicationStatus || "확인중"}`}
                          </p>
                        </div>
                      </button>

                      {!isApplied && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {project.can_chat && (
                            <button
                              type="button"
                              onClick={() => openTeamChat(project)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-600"
                            >
                              {openingChatProjectId === project.id ? "이동 중..." : "채팅"}
                            </button>
                          )}

                          {project.status === "completed" ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/memoir?projectId=${project.id}`)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                              회고
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => router.push(`/projects/${project.id}/manage`)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                              진행 관리
                            </button>
                          )}

                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">조건에 맞는 프로젝트가 없습니다.</p>
            )}
          </div>
        </section>
      </div>

    </main>
  );
}

function GithubIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.1c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.39-5.25 5.67.41.35.77 1.04.77 2.1v3.16c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function ProfileOptionPreview({ title, items, tone }) {
  const values = (items || []).map(getProfileOptionName).filter(Boolean);

  if (!values.length) return null;

  const className =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-bold text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfileOptionEditor({
  title,
  options,
  selectedItems,
  selectedClassName,
  onToggle,
}) {
  const selectedCount = selectedItems?.length ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-bold text-slate-800">
        {title}{" "}
        <span className="font-normal text-slate-400">
          ({selectedCount}개 선택)
        </span>
      </h3>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = hasProfileOption(selectedItems, option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                selected
                  ? selectedClassName
                  : "border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
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

async function loadReceivedReviews(userId, statsData) {
  try {
    const result = await getMyReceivedReviewsApi();
    const reviews = result.data || [];

    if (reviews.length > 0 || !statsData?.review_received) {
      return reviews;
    }
  } catch (error) {
    console.error("내 리뷰 조회 실패, 공개 리뷰 API로 재시도합니다:", error);
  }

  try {
    const fallbackResult = await getUserReceivedReviewsApi(userId);
    return fallbackResult.data || [];
  } catch (error) {
    console.error("공개 리뷰 API 재시도 실패:", error);
    return [];
  }
}

function buildProjectHistory(projects, applications) {
  const ownedProjectIds = new Set(projects.map((project) => Number(project.id)));
  const normalizedApplications = (applications || [])
    .filter((application) => !ownedProjectIds.has(Number(application.project_id)))
    .filter((application) => {
      const status = application.status || application.applicationStatus;
      const projectStatus = application.project_status || application.projectStatus;
      const hasOpenRecruitment =
        Number(application.open_recruitment_count ?? application.openRecruitmentCount ?? 0) > 0;

      return (
        status === "pending" &&
        (projectStatus === "planning" || hasOpenRecruitment)
      );
    })
    .map((application) => ({
      id: application.project_id,
      historyKey: `applied-${application.application_id}`,
      historyType: "applied",
      title: application.project_title,
      status: application.project_status || "planning",
      applicationStatus: application.status,
      difficulty: application.difficulty,
      category: application.category,
      progress_percent: application.progress_percent ?? 0,
      created_at: application.created_at,
      can_discard: false,
      can_chat: false,
    }));

  return [...projects, ...normalizedApplications];
}

function getProfileOptionName(option) {
  return typeof option === "string" ? option : option?.name || "";
}

function getProfileOptionId(option) {
  if (!option || typeof option === "string") return null;
  return option.id ?? option.skill_id ?? option.interest_id ?? null;
}

function normalizeProfileOptionName(value) {
  return String(value || "").trim().toLowerCase();
}

function findProfileOption(options, name) {
  const normalizedName = normalizeProfileOptionName(name);

  return (options || []).find(
    (option) => normalizeProfileOptionName(getProfileOptionName(option)) === normalizedName
  );
}

function hasProfileOption(options, name) {
  return Boolean(findProfileOption(options, name));
}

function formatProjectStatus(status) {
  const labels = {
    planning: "모집중",
    in_progress: "진행중",
    started: "진행중",
    paused: "일시중지",
    completed: "완료",
  };

  return labels[status] || status || "상태 없음";
}

function getProjectStatusClassName(status) {
  const classNames = {
    planning: "bg-blue-50 text-blue-700",
    in_progress: "bg-emerald-50 text-emerald-700",
    started: "bg-emerald-50 text-emerald-700",
    paused: "bg-amber-50 text-amber-700",
    completed: "bg-slate-200 text-slate-700",
  };

  return classNames[status] || "bg-slate-100 text-slate-600";
}

function getProjectLeaderId(project) {
  return (
    project?.leader_id ??
    project?.leaderId ??
    project?.leader?.id ??
    project?.owner_id ??
    project?.owner?.id ??
    project?.created_by ??
    project?.creator_id
  );
}

function isProjectLeader(project, userId) {
  const leaderId = Number(getProjectLeaderId(project));
  const currentUserId = Number(userId);

  if (Number.isFinite(leaderId) && Number.isFinite(currentUserId)) {
    return leaderId === currentUserId;
  }

  return (
    project?.is_leader === true ||
    project?.isLeader === true ||
    project?.role_in_project === "leader"
  );
}

function getVisibleProjects(projects, statusFilter, roleFilter, userId, sortOrder) {
  return [...projects]
    .filter((project) =>
      statusFilter === "all" ? true : project.status === statusFilter
    )
    .filter((project) => {
      if (roleFilter === "leader") return isProjectLeader(project, userId);
      if (roleFilter === "member") return !isProjectLeader(project, userId);
      return true;
    })
    .sort((a, b) => {
      if (a.historyType === "applied" && b.historyType !== "applied") return -1;
      if (a.historyType !== "applied" && b.historyType === "applied") return 1;

      if (sortOrder === "progress") {
        return (b.progress_percent ?? 0) - (a.progress_percent ?? 0);
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
}

function RatingSummary({ reputation }) {
  const items = [
    {
      label: "협업",
      value: reputation?.avg_teamwork,
    },
    {
      label: "기여",
      value: reputation?.avg_contribution,
    },
    {
      label: "책임",
      value: reputation?.avg_responsibility,
    },
  ];

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="rounded-2xl bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-600">종합 평점</p>
        <p className="mt-2 text-4xl font-black text-slate-900">
          {formatRating(reputation?.score)}
        </p>
        <p className="mt-1 text-sm text-slate-500">5점 만점</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 p-5">
        {items.map((item) => (
          <RatingRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function RatingRow({ label, value }) {
  const ratingValue = normalizeRating(value);

  return (
    <div className="grid gap-2 sm:grid-cols-[70px_1fr_48px] sm:items-center">
      <p className="text-sm font-bold text-slate-800">{label}</p>

      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-red-600"
          style={{ width: `${(ratingValue / 5) * 100}%` }}
        />
      </div>

      <p className="text-right text-sm font-bold text-slate-700">
        {formatRating(ratingValue)}
      </p>
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
