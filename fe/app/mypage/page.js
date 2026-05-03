"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyProfileApi,
  getMyReputationApi,
  getUserStatsApi,
  getUserProjectsApi,
  getMyReceivedReviewsApi,
} from "../../lib/api";

export default function MyPage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    async function loadMyPage() {
      try {
        setLoading(true);

        const profileResult = await getMyProfileApi();
        const profileData = profileResult.data;
        setProfile(profileData);

        const reputationResult = await getMyReputationApi();
        setReputation(reputationResult.data);

        const statsResult = await getUserStatsApi(profileData.id);
        setStats(statsResult.data);

        const projectsResult = await getUserProjectsApi(profileData.id);
        setProjects(projectsResult.data);

        const reviewsResult = await getMyReceivedReviewsApi();
        setReviews(reviewsResult.data);
      } catch (error) {
        console.error(error);
        alert("마이페이지 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadMyPage();
  }, []);

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

        {/* 프로필 */}
        <section className="mb-6 rounded-2xl border bg-white p-8 shadow-sm">
          <div className="flex gap-6 items-center">
            <div className="h-24 w-24 rounded-full bg-red-100 flex items-center justify-center text-3xl font-bold text-red-600">
              {profile?.nickname?.[0]}
            </div>

            <div>
              <h1 className="text-3xl font-bold">{profile?.nickname}</h1>
              <p className="text-slate-500">{profile?.email}</p>
              <p className="mt-2">{profile?.bio}</p>
            </div>
          </div>
        </section>

        {/* 통계 */}
        <section className="grid grid-cols-3 gap-4 mb-6">

          <StatCard
            title="리드 프로젝트"
            value={stats?.lead_projects}
          />

          <StatCard
            title="완료 프로젝트"
            value={stats?.completed_projects}
          />

          {/* 받은 리뷰 클릭 */}
          <button
            onClick={() => setShowReviews(!showReviews)}
            className="bg-white p-6 rounded-2xl shadow hover:bg-red-50 text-left"
          >
            <p className="text-sm text-slate-500">받은 리뷰</p>
            <p className="text-3xl font-bold">
              {stats?.review_received}
            </p>
          </button>

        </section>

        {/* 리뷰 목록 */}
        {showReviews && (
          <section className="mb-6 bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-bold mb-4">받은 리뷰</h2>

            {reviews.length === 0 ? (
              <p>리뷰 없음</p>
            ) : (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="border p-4 rounded-xl mb-3"
                >
                  <p className="font-bold">
                    {review.project?.title}
                  </p>

                  <p className="text-sm text-gray-400">
                    익명 • {new Date(review.created_at).toLocaleDateString()}
                  </p>

                  <div className="text-sm mt-2">
                    협업 {review.teamwork_score} / 
                    기여 {review.contribution_score} / 
                    책임 {review.responsibility_score}
                  </div>

                  <p className="mt-2">{review.comment}</p>
                </div>
              ))
            )}
          </section>
        )}

        {/* 신뢰도 */}
        <section className="mb-6 bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">신뢰도</h2>

          <div className="grid grid-cols-4 gap-4">
            <MiniStat label="종합" value={reputation?.score} />
            <MiniStat label="협업" value={reputation?.avg_teamwork} />
            <MiniStat label="기여" value={reputation?.avg_contribution} />
            <MiniStat label="책임" value={reputation?.avg_responsibility} />
          </div>
        </section>

        {/* 프로젝트 이력 */}
        <section className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">프로젝트 이력</h2>

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
                            난이도 {project.difficulty}
                        </p>
                        </div>

                        <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                            {project.status}
                        </span>

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
              <p>프로젝트 없음</p>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-gray-100 p-4 rounded-xl">
      <p className="text-sm">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}