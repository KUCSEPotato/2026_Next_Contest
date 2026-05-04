"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyProfileApi,
  getMyReputationApi,
  getUserStatsApi,
  getUserProjectsApi,
  getMyReceivedReviewsApi,
  updateMyProfileApi,
  addMySkillApi,
  addMyInterestApi,
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

  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

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

  const handleUpdateProfile = async () => {
    try {
      const result = await updateMyProfileApi({
        nickname: editNickname,
        bio: editBio,
        avatar_url: editAvatarUrl,
      });

      alert("프로필이 수정되었습니다.");

      setProfile((prev) => ({
        ...prev,
        ...result.data,
        email: prev?.email,
        skills: prev?.skills,
        interests: prev?.interests,
      }));
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
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-red-100 text-3xl font-bold text-red-600">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="profile"
                  className="h-full w-full object-cover"
                />
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
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">프로필 수정</h2>

          <div className="mt-4 space-y-4">
            <input
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder="닉네임"
              className={inputClassName}
            />

            <input
              value={editAvatarUrl}
              onChange={(e) => setEditAvatarUrl(e.target.value)}
              placeholder="프로필 이미지 URL"
              className={inputClassName}
            />

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
              reviews.map((review) => (
                <div key={review.id} className="mb-3 rounded-xl border p-4">
                  <p className="font-bold">{review.project?.title}</p>
                  <p className="text-sm text-gray-400">
                    익명 • {new Date(review.created_at).toLocaleDateString()}
                  </p>

                  <div className="mt-2 text-sm">
                    협업 {review.teamwork_score} / 기여{" "}
                    {review.contribution_score} / 책임{" "}
                    {review.responsibility_score}
                  </div>

                  <p className="mt-2">{review.comment}</p>
                </div>
              ))
            )}
          </section>
        )}

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">신뢰도</h2>

          <div className="grid grid-cols-4 gap-4">
            <MiniStat label="종합" value={reputation?.score ?? 0} />
            <MiniStat label="협업" value={reputation?.avg_teamwork ?? 0} />
            <MiniStat label="기여" value={reputation?.avg_contribution ?? 0} />
            <MiniStat label="책임" value={reputation?.avg_responsibility ?? 0} />
          </div>
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
                    key={skill}
                    className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700"
                  >
                    {skill}
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
                    key={interest}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {interest}
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

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-100 p-4">
      <p className="text-sm">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}