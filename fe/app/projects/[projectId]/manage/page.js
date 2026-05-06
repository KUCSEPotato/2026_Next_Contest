"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProjectApi,
  getProjectApplicationsApi,
  decideProjectApplicationApi,
  getMyProfileApi,
} from "../../../../lib/api";

export default function ProjectManagePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [projectResult, profileResult, applicationsResult] =
          await Promise.all([
            getProjectApi(projectId),
            getMyProfileApi(),
            getProjectApplicationsApi(projectId),
          ]);

        setProject(projectResult.data);
        setProfile(profileResult.data);
        setApplications(applicationsResult.data || []);
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
  const canAcceptMore = !maxMembers || acceptedCount < maxMembers;

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

      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? { ...application, status }
            : application
        )
      );

      alert(status === "accepted" ? "지원자를 승인했습니다." : "지원자를 거절했습니다.");
    } catch (error) {
      console.error(error);
      alert("지원 상태 변경에 실패했습니다.");
    } finally {
      setProcessingId(null);
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
            확정 인원: {acceptedCount} / {maxMembers || "제한 없음"}
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
      </div>
    </main>
  );
}