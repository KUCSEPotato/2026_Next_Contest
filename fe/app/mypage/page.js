"use client";

import { useEffect, useState } from "react";
import {
  getMyProfileApi,
  getMyReputationApi,
  getUserStatsApi,
  getUserProjectsApi,
} from "../../lib/api";

export default function MyPage() {
  const [profile, setProfile] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <p className="text-slate-500">프로필 정보가 없습니다.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-3xl font-bold text-blue-600">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.nickname?.[0] || "D"
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-blue-600">My Page</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {profile.nickname || "이름 없는 사용자"}
              </h1>
              <p className="mt-2 text-slate-500">{profile.email}</p>
              <p className="mt-3 max-w-2xl text-slate-700">
                {profile.bio || "아직 자기소개가 없습니다."}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            title="리드 프로젝트"
            value={stats?.lead_projects ?? 0}
            description="내가 리더로 진행한 프로젝트"
          />
          <StatCard
            title="완료 프로젝트"
            value={stats?.completed_projects ?? 0}
            description="완료 상태 프로젝트"
          />
          <StatCard
            title="받은 리뷰"
            value={stats?.review_received ?? 0}
            description="팀원에게 받은 리뷰"
          />
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">신뢰도</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <MiniStat label="종합 점수" value={reputation?.score ?? 0} />
            <MiniStat label="협업" value={reputation?.avg_teamwork ?? 0} />
            <MiniStat label="기여도" value={reputation?.avg_contribution ?? 0} />
            <MiniStat label="책임감" value={reputation?.avg_responsibility ?? 0} />
          </div>

          <p className="mt-4 text-sm text-slate-500">
            리뷰 수: {reputation?.review_count ?? 0}개
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">기술 스택</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills?.length ? (
                profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">등록된 기술 스택이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">관심 분야</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests?.length ? (
                profile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {interest}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">등록된 관심 분야가 없습니다.</p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">프로젝트 이력</h2>

          <div className="mt-4 space-y-3">
            {projects.length ? (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4"
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

                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                      {project.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">아직 프로젝트 이력이 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}