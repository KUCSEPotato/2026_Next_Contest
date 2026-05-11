"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getChatRoomsApi,
  createChatRoomApi,
  getProjectApi,
  getMyProfileApi,
} from "../../../../lib/api";

export default function ProjectChatRoomsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [rooms, setRooms] = useState([]);
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  const loadRooms = async () => {
    try {
      setLoading(true);

      const [roomsResult, projectResult, profileResult] = await Promise.all([
        getChatRoomsApi(projectId),
        getProjectApi(projectId),
        getMyProfileApi(),
      ]);

      setRooms(Array.isArray(roomsResult.data) ? roomsResult.data : []);
      setProject(projectResult.data);
      setProfile(profileResult.data);
    } catch (error) {
      console.error(error);
      alert("채팅방 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadRooms();
    }
  }, [projectId]);

  const isLeader = project && profile && project.leader_id === profile.id;
  const canCreateRoom = isLeader && project?.status === "in_progress";

  const projectMembers =
    project?.members ||
    project?.project_members ||
    project?.team_members ||
    [];

  const selectableMembers = projectMembers.filter((member) => {
    const userId = member.user_id || member.id || member.user?.id;
    return userId && userId !== profile?.id;
  });

  const toggleMember = (userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateRoom = async () => {
    if (!canCreateRoom) {
      alert("팀 결성 후 프로젝트 리더만 채팅방을 만들 수 있습니다.");
      return;
    }

    if (!roomName.trim()) {
      alert("채팅방 이름을 입력해주세요.");
      return;
    }

    if (selectedMemberIds.length === 0) {
      alert("채팅방에 추가할 팀원을 선택해주세요.");
      return;
    }

    try {
      const finalMemberIds = Array.from(
        new Set([profile.id, ...selectedMemberIds])
      );

      const result = await createChatRoomApi(projectId, {
        name: roomName.trim(),
        member_ids: finalMemberIds,
      });

      alert("채팅방이 생성되었습니다.");
      router.push(`/chat/${result.data.id}?projectId=${projectId}`);
    } catch (error) {
      console.error(error);
      alert("채팅방 생성에 실패했습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-red-600">
            Project #{projectId}
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            프로젝트 채팅방
          </h1>

          <p className="mt-3 text-slate-600">
            팀 결성이 완료된 프로젝트의 채팅방을 확인할 수 있습니다.
          </p>
        </div>

        {canCreateRoom && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              새 채팅방 만들기
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              프로젝트 리더는 팀원들과 별도의 주제별 채팅방을 만들 수 있습니다.
            </p>

            <div className="mt-4 flex gap-3">
              <input
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="예: 000프로젝트 - BE"
              />

              <button
                onClick={handleCreateRoom}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                생성
              </button>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-700">
                채팅방에 추가할 팀원 선택
              </p>

              {selectableMembers.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  선택할 수 있는 팀원이 없습니다.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectableMembers.map((member) => {
                    const userId = member.user_id || member.id || member.user?.id;
                    const nickname =
                      member.nickname ||
                      member.user?.nickname ||
                      member.name ||
                      `User #${userId}`;

                    return (
                      <label
                        key={userId}
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:border-red-300 hover:bg-red-50"
                      >
                        <span className="text-sm font-medium text-slate-700">
                          {nickname}
                        </span>

                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(userId)}
                          onChange={() => toggleMember(userId)}
                          className="h-4 w-4 accent-red-600"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && project?.status !== "in_progress" && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-600">
              팀 결성이 완료되면 채팅방이 생성됩니다.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">채팅방 목록</h2>

          {loading ? (
            <p className="mt-4 text-slate-500">불러오는 중...</p>
          ) : rooms.length === 0 ? (
            <p className="mt-4 text-slate-500">아직 채팅방이 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() =>
                    router.push(`/chat/${room.id}?projectId=${projectId}`)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-red-300 hover:bg-red-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {room.name || "이름 없는 채팅방"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Room #{room.id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        room.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {room.is_active ? "활성" : "비활성"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}