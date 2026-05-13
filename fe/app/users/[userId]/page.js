"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getUserProfileApi,
  getUserReputationApi,
  getUserStatsApi,
  getUserProjectsApi,
  getUserReceivedReviewsApi,
  getImageUrl,
  createReportApi,
} from "../../../lib/api";
import { useDialog, useToast } from "../../../components/AppFeedback";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { prompt } = useDialog();
  const userId = params.userId;

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviews, setShowReviews] = useState(false);
  const [projectRoleFilter, setProjectRoleFilter] = useState("all");

  useEffect(() => {
    async function loadUserProfile() {
      try {
        setLoading(true);

        const [profileResult, reputationResult, statsResult, projectsResult, reviewsResult] =
          await Promise.allSettled([
            getUserProfileApi(userId),
            getUserReputationApi(userId),
            getUserStatsApi(userId),
            getUserProjectsApi(userId),
            getUserReceivedReviewsApi(userId),
          ]);

        if (profileResult.status !== "fulfilled") {
          throw new Error("프로필 조회 실패");
        }

        setProfile(profileResult.value.data);

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
                in_progress_projects: 0,
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
        console.error(error);
        alert("사용자 프로필을 불러오지 못했습니다.");
        router.back();
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      loadUserProfile();
    }
  }, [userId, router]);

  const handleReportUser = async () => {
    const myUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    if (!myUserId) {
      router.push("/login");
      return;
    }
    if (String(myUserId) === String(userId)) {
      toast.warning("본인 계정은 신고할 수 없습니다.");
      return;
    }

    const reasonInput = await prompt({
      title: "사용자 신고",
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
        target_type: "user",
        target_id: Number(userId),
        reason: reasonInput.trim(),
      });
      toast.success("신고가 접수되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "신고 접수에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">프로필을 불러오는 중...</p>
      </main>
    );
  }

  const visibleProjects = getVisibleProjects(
    projects,
    projectRoleFilter,
    profile?.id ?? userId
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          ← 돌아가기
        </button>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-6">
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

            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-slate-900">
                {profile?.nickname || "이름 없는 사용자"}
              </h1>

              <p className="mt-2 text-slate-700">
                {profile?.bio || "아직 자기소개가 없습니다."}
              </p>
            </div>
            <button
              onClick={handleReportUser}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600"
            >
              사용자 신고
            </button>
          </div>
        </section>

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
                받은 리뷰를 바탕으로 한 평점 정보입니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                받은 평가 {reputation?.review_count ?? stats?.review_received ?? 0}개
              </div>
              <button
                type="button"
                onClick={() => setShowReviews((prev) => !prev)}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                {showReviews ? "리뷰 접기" : "리뷰 상세보기"}
              </button>
            </div>
          </div>

          <RatingSummary reputation={reputation} />

          {showReviews && (
            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">리뷰 없음</p>
              ) : (
                reviews.map((review) => {
                  const reviewMessage = getReviewMessage(review);

                  return (
                    <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="font-bold text-slate-900">
                        {review.project?.title || "프로젝트"}
                      </p>

                      <p className="text-sm text-slate-400">
                        익명{" "}
                        {review.created_at
                          ? `• ${new Date(review.created_at).toLocaleDateString()}`
                          : ""}
                      </p>

                      <div className="mt-2 text-sm text-slate-600">
                        협업 {review.teamwork_score} / 기여{" "}
                        {review.contribution_score} / 책임{" "}
                        {review.responsibility_score}
                      </div>

                      <p className="mt-2 text-sm text-slate-700">
                        {reviewMessage || "작성된 리뷰 메시지가 없습니다."}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">기술 스택</h2>

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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold">프로젝트 이력</h2>

            <select
              value={projectRoleFilter}
              onChange={(e) => setProjectRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition focus:border-red-500"
            >
              <option value="all">전체 역할</option>
              <option value="leader">리더 프로젝트</option>
              <option value="member">팀원으로 참여</option>
            </select>
          </div>

          <div className="space-y-3">
            {visibleProjects.length ? (
              visibleProjects.map((project) => {
                const isLeader = isProjectLeader(project, profile?.id ?? userId);

                return (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-red-300 hover:bg-red-50"
                  >
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {project.title}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          난이도 {project.difficulty || "미정"}
                        </p>
                      </div>

                      <div className="flex min-w-48 items-center justify-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getProjectStatusClassName(project.status)}`}>
                          {formatProjectStatus(project.status)}
                        </span>

                        <span
                          className={`min-w-14 rounded-full px-3 py-1 text-center text-sm font-semibold ${
                            isLeader
                              ? "bg-red-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {isLeader ? "리더" : "팀원"}
                        </span>
                      </div>
                    </div>
                  </button>
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

function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function RatingSummary({ reputation }) {
  const items = [
    ["협업", reputation?.avg_teamwork],
    ["기여", reputation?.avg_contribution],
    ["책임", reputation?.avg_responsibility],
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
        {items.map(([label, value]) => {
          const ratingValue = normalizeRating(value);

          return (
            <div
              key={label}
              className="grid gap-2 sm:grid-cols-[70px_1fr_48px] sm:items-center"
            >
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
        })}
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

function getVisibleProjects(projects, roleFilter, userId) {
  return projects.filter((project) => {
    if (roleFilter === "leader") return isProjectLeader(project, userId);
    if (roleFilter === "member") return !isProjectLeader(project, userId);
    return true;
  });
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
