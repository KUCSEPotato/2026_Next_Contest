"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getUserProfileApi,
  getUserStatsApi,
  getUserProjectsApi,
  getUserReceivedReviewsApi,
  getImageUrl,
} from "../../../lib/api";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId;

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        setLoading(true);

        const [profileResult, statsResult, projectsResult, reviewsResult] =
          await Promise.allSettled([
            getUserProfileApi(userId),
            getUserStatsApi(userId),
            getUserProjectsApi(userId),
            getUserReceivedReviewsApi(userId),
          ]);

        if (profileResult.status !== "fulfilled") {
          throw new Error("프로필 조회 실패");
        }

        setProfile(profileResult.value.data);

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

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">프로필을 불러오는 중...</p>
      </main>
    );
  }

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

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {profile?.nickname || "이름 없는 사용자"}
              </h1>

              <p className="mt-2 text-slate-700">
                {profile?.bio || "아직 자기소개가 없습니다."}
              </p>
            </div>
          </div>
        </section>

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
                  <div key={review.id} className="mb-3 rounded-xl border p-4">
                    <p className="font-bold">
                      {review.project?.title || "프로젝트"}
                    </p>

                    <p className="text-sm text-gray-400">
                      익명{" "}
                      {review.created_at
                        ? `• ${new Date(review.created_at).toLocaleDateString()}`
                        : ""}
                    </p>

                    <div className="mt-2 text-sm">
                      협업 {review.teamwork_score} / 기여{" "}
                      {review.contribution_score} / 책임{" "}
                      {review.responsibility_score}
                    </div>

                    <p className="mt-2">
                      {reviewMessage || "작성된 리뷰 메시지가 없습니다."}
                    </p>
                  </div>
                );
              })
            )}
          </section>
        )}

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

                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                      {project.status || "상태 없음"}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">프로젝트 없음</p>
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

function getReviewMessage(review) {
  const message =
    review?.comment ||
    review?.message ||
    review?.review_message ||
    review?.content ||
    "";

  return String(message).trim();
}
