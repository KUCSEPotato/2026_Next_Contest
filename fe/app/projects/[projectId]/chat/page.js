"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getChatRoomsApi,
  createChatRoomApi,
} from "../../../../lib/api";

export default function ProjectChatRoomsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId;

  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("팀장 문의방");
  const [loading, setLoading] = useState(true);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const result = await getChatRoomsApi(projectId);
      setRooms(result.data);
    } catch (error) {
      console.error(error);
      alert("채팅방 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [projectId]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      alert("채팅방 이름을 입력해주세요.");
      return;
    }

    try {
      const result = await createChatRoomApi(projectId, roomName);
      alert("채팅방이 생성되었습니다.");
      router.push(`/chat/${result.data.id}`);
    } catch (error) {
      console.error(error);
      alert("채팅방 생성에 실패했습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">
            Project #{projectId}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            프로젝트 채팅방
          </h1>
          <p className="mt-3 text-slate-600">
            프로젝트 멤버들과 대화할 채팅방을 선택하거나 새로 만들 수 있습니다.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">새 채팅방 만들기</h2>

          <div className="mt-4 flex gap-3">
            <input
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="예: 팀장 문의방"
            />

            <button
              onClick={handleCreateRoom}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              생성
            </button>
          </div>
        </section>

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
                  onClick={() => router.push(`/chat/${room.id}`)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
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